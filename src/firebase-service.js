import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    setDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    onSnapshot,
    query,
    where,
    writeBatch,
    increment,
    runTransaction,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COLLECTION_NAME = "expenseCollection";

/**
 * Add a transaction to a sub-collection
 * @param {string} sourceId - The ID of the parent expense document
 * @param {object} transactionData - The transaction details
 */
export async function addTransaction(sourceId, transactionData) {
    try {
        const batch = writeBatch(db);
        const subColRef = collection(db, COLLECTION_NAME, sourceId, "transactions");
        const docRef = doc(subColRef); // Generate ID client-side for batch

        batch.set(docRef, transactionData);

        // Atomic increments for parent document
        const parentRef = doc(db, COLLECTION_NAME, sourceId);
        const amt = Number(transactionData.amount) || 0;
        const updates = {
            totalOutstanding: increment(amt)
        };
        if (transactionData.status === "pending") {
            updates.outstanding = increment(amt);
        }
        batch.update(parentRef, updates);

        await batch.commit();

        console.log("Transaction added atomically with ID: ", docRef.id);
        return docRef;
    } catch (e) {
        console.error("Error adding transaction atomically: ", e);
        throw e;
    }
}

/**
 * Subscribe to real-time updates of the expenseCollection
 * @param {function} callback - Function to call with the list of items
 */
export function subscribeToTransactions(sourceId, callback, onError) {
    const q = collection(db, COLLECTION_NAME, sourceId, "transactions");
    // Ideally order by date, but requires index. For now just fetch.
    return onSnapshot(q, (querySnapshot) => {
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        // Sort by date desc client-side
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
        callback(items);
    }, (error) => {
        console.error("Transactions snapshot error:", error);
        if (onError) onError(error);
    });
}

/**
 * Subscribe to real-time updates of the expenseCollection
 * @param {function} callback - Function to call with the list of items
 */
export function subscribeToItems(callback, onError) {
    const q = collection(db, COLLECTION_NAME);
    return onSnapshot(q, (querySnapshot) => {
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        callback(items);
    }, (error) => {
        console.error("Snapshot error:", error);
        if (onError) onError(error);
    });
}

/**
 * Delete an expense from Firestore
 * @param {string} id - The document ID to delete
 */
export async function deleteItem(id) {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        console.log("Document deleted with ID: ", id);
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw e;
    }
}

/**
 * Update an expense in Firestore
 * @param {string} id - The document ID to update
 * @param {object} data - The data to update
 */
export async function updateItem(id, data) {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, data);
        // console.log("Document updated with ID: ", id);
    } catch (e) {
        console.error("Error updating document: ", e);
        throw e;
    }
}

/**
 * Calculate both pending and total individual sums for a source
 * @param {string} sourceId - The ID of the parent expense document
 * @returns {Promise<{outstanding: number, totalOutstanding: number}>} - The sums
 */
export async function getSourceTotals(sourceId) {
    try {
        const transactionsRef = collection(db, COLLECTION_NAME, sourceId, "transactions");
        const querySnapshot = await getDocs(transactionsRef);

        let outstanding = 0;
        let totalOutstanding = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const amt = Number(data.amount) || 0;
            totalOutstanding += amt;
            if (data.status === "pending") {
                outstanding += amt;
            }
        });

        console.log(`Totals for ${sourceId}:`, { outstanding, totalOutstanding });
        return { outstanding, totalOutstanding };
    } catch (e) {
        console.error("Error calculating source totals:", e);
        throw e;
    }
}

/**
 * Update status of a single transaction
 */
export async function updateTransactionStatus(sourceId, transactionId, status) {
    try {
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, COLLECTION_NAME, sourceId, "transactions", transactionId);
            const parentRef = doc(db, COLLECTION_NAME, sourceId);

            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists()) throw "Transaction does not exist!";

            const oldStatus = txDoc.data().status;
            const amt = Number(txDoc.data().amount) || 0;

            if (oldStatus === status) return; // No change

            // Update status
            transaction.update(txRef, { status: status });

            // Update parent totals based on delta
            if (oldStatus === "pending" && status === "paid") {
                transaction.update(parentRef, { outstanding: increment(-amt) });
            } else if (oldStatus === "paid" && status === "pending") {
                transaction.update(parentRef, { outstanding: increment(amt) });
            }
        });

        console.log(`Transaction ${transactionId} status updated atomically to ${status}`);
    } catch (e) {
        console.error("Error updating transaction status atomically:", e);
        throw e;
    }
}

/**
 * Bulk update transactions status and apply atomic increments to parent outstanding
 */
export async function bulkUpdateTransactionStatus(sourceId, transactionIds, status) {
    try {
        const batch = writeBatch(db);
        const parentRef = doc(db, COLLECTION_NAME, sourceId);

        let delta = 0;

        for (const id of transactionIds) {
            const txRef = doc(db, COLLECTION_NAME, sourceId, "transactions", id);
            const txDoc = await getDoc(txRef);

            if (txDoc.exists()) {
                const data = txDoc.data();
                const amt = Number(data.amount) || 0;
                const oldStatus = data.status;

                if (oldStatus === status) continue;

                batch.update(txRef, { status: status });

                if (oldStatus === "pending" && status === "paid") {
                    delta -= amt;
                } else if (oldStatus === "paid" && status === "pending") {
                    delta += amt;
                }
            }
        }

        if (delta !== 0) {
            batch.update(parentRef, { outstanding: increment(delta) });
        }

        await batch.commit();

        console.log(`Bulk updated ${transactionIds.length} transactions to ${status}. Total delta: ${delta}`);
    } catch (e) {
        console.error("Error bulk updating transactions:", e);
        throw e;
    }
}

/**
 * Update a single transaction and recalculate source totals
 */
export async function updateTransaction(sourceId, transactionId, data) {
    try {
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, COLLECTION_NAME, sourceId, "transactions", transactionId);
            const parentRef = doc(db, COLLECTION_NAME, sourceId);

            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists()) throw "Transaction does not exist!";

            const oldData = txDoc.data();
            const oldAmt = Number(oldData.amount) || 0;
            const newAmt = Number(data.amount) || 0;

            const oldStatus = oldData.status;
            const newStatus = data.status || oldData.status;

            // Update transaction
            transaction.update(txRef, data);

            // Calculate deltas
            const totalDelta = newAmt - oldAmt;
            let outstandingDelta = 0;

            // Simple delta calculation logic
            if (oldStatus === "pending" && newStatus === "pending") {
                outstandingDelta = newAmt - oldAmt;
            } else if (oldStatus === "pending" && newStatus === "paid") {
                outstandingDelta = -oldAmt;
            } else if (oldStatus === "paid" && newStatus === "pending") {
                outstandingDelta = newAmt;
            }

            const parentUpdates = {};
            if (totalDelta !== 0) parentUpdates.totalOutstanding = increment(totalDelta);
            if (outstandingDelta !== 0) parentUpdates.outstanding = increment(outstandingDelta);

            if (Object.keys(parentUpdates).length > 0) {
                transaction.update(parentRef, parentUpdates);
            }
        });
    } catch (e) {
        console.error("Error updating transaction atomically:", e);
        throw e;
    }
}

/**
 * Delete a single transaction and recalculate source totals
 */
export async function deleteTransaction(sourceId, transactionId) {
    try {
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, COLLECTION_NAME, sourceId, "transactions", transactionId);
            const parentRef = doc(db, COLLECTION_NAME, sourceId);

            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists()) return; // Already deleted

            const data = txDoc.data();
            const amt = Number(data.amount) || 0;
            const status = data.status;

            transaction.delete(txRef);

            const parentUpdates = {
                totalOutstanding: increment(-amt)
            };
            if (status === "pending") {
                parentUpdates.outstanding = increment(-amt);
            }
            transaction.update(parentRef, parentUpdates);
        });
    } catch (e) {
        console.error("Error deleting transaction atomically:", e);
        throw e;
    }
}

/**
 * Move a transaction from one source to another atomically
 */
export async function moveTransaction(oldSourceId, newSourceId, transactionId, data) {
    try {
        await runTransaction(db, async (transaction) => {
            const oldTxRef = doc(db, COLLECTION_NAME, oldSourceId, "transactions", transactionId);
            const newTxRef = doc(collection(db, COLLECTION_NAME, newSourceId, "transactions"));
            const oldParentRef = doc(db, COLLECTION_NAME, oldSourceId);
            const newParentRef = doc(db, COLLECTION_NAME, newSourceId);

            const txDoc = await transaction.get(oldTxRef);
            if (!txDoc.exists()) throw "Transaction does not exist!";

            const oldTxData = txDoc.data();
            const oldAmt = Number(oldTxData.amount) || 0;
            const newAmt = Number(data.amount) || 0;
            const oldStatus = oldTxData.status;
            const newStatus = data.status || oldStatus;

            // 1. Delete from old source
            transaction.delete(oldTxRef);
            const oldParentUpdates = { totalOutstanding: increment(-oldAmt) };
            if (oldStatus === "pending") oldParentUpdates.outstanding = increment(-oldAmt);
            transaction.update(oldParentRef, oldParentUpdates);

            // 2. Add to new source
            transaction.set(newTxRef, data);
            const newParentUpdates = { totalOutstanding: increment(newAmt) };
            if (newStatus === "pending") newParentUpdates.outstanding = increment(newAmt);
            transaction.update(newParentRef, newParentUpdates);
        });
        console.log(`Transaction moved from ${oldSourceId} to ${newSourceId}`);
    } catch (e) {
        console.error("Error moving transaction atomically:", e);
        throw e;
    }
}

/**
 * Fetch all transactions across multiple sourceIds (one-shot, for analytics)
 * @param {string[]} sourceIds - Array of source document IDs
 * @returns {Promise<object[]>} - Flat array of transactions with sourceId attached
 */
export async function fetchAllTransactions(sourceIds) {
    const results = [];
    await Promise.all(sourceIds.map(async (sourceId) => {
        const subColRef = collection(db, COLLECTION_NAME, sourceId, "transactions");
        const snapshot = await getDocs(subColRef);
        snapshot.forEach((doc) => {
            results.push({ id: doc.id, sourceId, ...doc.data() });
        });
    }));
    return results;
}

