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
    writeBatch
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
        const subColRef = collection(db, COLLECTION_NAME, sourceId, "transactions");
        const docRef = await addDoc(subColRef, transactionData);

        const totals = await getSourceTotals(sourceId);
        await updateItem(sourceId, totals);

        console.log("Transaction added with ID: ", docRef.id);
        console.log(transactionData);
        return docRef;
    } catch (e) {
        console.error("Error adding transaction: ", e);
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
        const txRef = doc(db, COLLECTION_NAME, sourceId, "transactions", transactionId);
        await updateDoc(txRef, { status: status });

        // Recalculate totals
        const totals = await getSourceTotals(sourceId);
        await updateItem(sourceId, totals);

        console.log(`Transaction ${transactionId} status updated to ${status}`);
    } catch (e) {
        console.error("Error updating transaction status:", e);
        throw e;
    }
}

/**
 * Mark multiple transactions as paid
 */
export async function markTransactionsAsPaid(sourceId, transactionIds) {
    try {
        const batch = writeBatch(db);
        if (transactionIds.length === 0) return;

        transactionIds.forEach(id => {
            const docRef = doc(db, COLLECTION_NAME, sourceId, "transactions", id);
            batch.update(docRef, { status: "paid" });
        });
        await batch.commit();

        // Recalculate totals
        const totals = await getSourceTotals(sourceId);
        await updateItem(sourceId, totals);

        console.log(`Marked ${transactionIds.length} transactions as paid.`);
    } catch (e) {
        console.error("Error batch updating transactions:", e);
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

