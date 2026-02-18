import { subscribeToItems, updateItem, subscribeToTransactions, updateTransactionStatus, bulkUpdateTransactionStatus, updateTransaction, deleteTransaction } from "./firebase-service.js";

const listContainer = document.getElementById("items-list");
const loadingIndicator = document.getElementById("loading");

// View Transactions Modal Elements
const txModal = document.getElementById("transactions-modal");
const closeTxModalBtn = document.querySelector(".close-transactions-btn");
const txListContainer = document.getElementById("transactions-list");
const txTitle = document.getElementById("transactions-title");
const filterOwner = document.getElementById("filter-owner");
const filterMonth = document.getElementById("filter-month");
const markPaidBtn = document.getElementById("mark-paid-btn");
let txUnsubscribe = null;
let currentTransactions = [];
let currentSourceId = null;

// Edit Transaction Modal Elements
const txEditModal = document.getElementById("tx-edit-modal");
const txEditForm = document.getElementById("tx-edit-form");
const closeTxEditBtn = document.getElementById("close-tx-edit-btn");
const deleteTxBtn = document.getElementById("delete-tx-btn");

const editTxDate = document.getElementById("edit-tx-date");
const editTxCategory = document.getElementById("edit-tx-category");
const editTxAmount = document.getElementById("edit-tx-amount");
const editTxOwner = document.getElementById("edit-tx-owner");
const editTxDetails = document.getElementById("edit-tx-details");
const editTxComment = document.getElementById("edit-tx-comment");

let editingTransactionId = null;

const CATEGORIES = ["Grocery", "Pets", "Fuel", "Dining", "LIC/OICL", "Travel", "Entertainment", "Utility Bills", "Rent", "Other"];

// Populate categories for edit modal
const populateEditCategories = () => {
    editTxCategory.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
};
populateEditCategories();

// Alert Modal Elements
const alertModal = document.getElementById("alert-modal");
const alertMessage = document.getElementById("alert-message");
const alertOkBtn = document.getElementById("alert-ok-btn");
const alertCancelBtn = document.getElementById("alert-cancel-btn");

function showNotification(message, isConfirmation = false, onConfirmCallback = null) {
    alertMessage.textContent = message;
    alertModal.style.display = "block";
    alertOkBtn.onclick = () => {
        alertModal.style.display = "none";
        if (isConfirmation && onConfirmCallback) onConfirmCallback();
    };
    if (isConfirmation) {
        alertCancelBtn.style.display = "inline-block";
        alertCancelBtn.onclick = () => alertModal.style.display = "none";
    } else {
        alertCancelBtn.style.display = "none";
    }
}

// Subscribe to items for the table
subscribeToItems((items) => {
    loadingIndicator.style.display = "none";
    renderItems(items);
});

function renderItems(items) {
    listContainer.innerHTML = "";
    if (items.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding:15px;">No sources found.</td></tr>`;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${item.id}</strong></td>
            <td>₹${(item.outstanding || 0).toLocaleString()}</td>
            <td>₹${(item.totalOutstanding || 0).toLocaleString()}</td>
            <td>
                 <div class="item-actions">
                    <button class="view-btn" style="background-color: #3498db; padding: 5px 10px; font-size: 0.8rem; color: white; border: none; border-radius: 4px; cursor: pointer;">View</button>
                </div>
            </td>
        `;
        tr.querySelector(".view-btn").addEventListener("click", () => openTransactionsModal(item.id));
        listContainer.appendChild(tr);
    });
}

function openTransactionsModal(sourceId) {
    currentSourceId = sourceId;
    txTitle.innerText = `Transactions: ${sourceId}`;
    txListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">Loading...</td></tr>';
    txModal.style.display = "block";
    filterOwner.value = "All";
    filterMonth.innerHTML = '<option value="All">All Months</option>';
    if (txUnsubscribe) txUnsubscribe();
    txUnsubscribe = subscribeToTransactions(sourceId, (transactions) => {
        currentTransactions = transactions;
        populateMonthFilter(transactions);
        renderTransactions();
    });
}

function populateMonthFilter(transactions) {
    const months = new Set();
    transactions.forEach(tx => tx.date && months.add(tx.date.substring(0, 7)));
    const sortedMonths = Array.from(months).sort().reverse();
    filterMonth.innerHTML = '<option value="All">All Months</option>';
    sortedMonths.forEach(m => {
        const option = document.createElement("option");
        option.value = m;
        option.textContent = m;
        filterMonth.appendChild(option);
    });
}

function renderTransactions() {
    const ownerFilter = filterOwner.value;
    const monthFilter = filterMonth.value;
    const filtered = currentTransactions.filter(tx => (ownerFilter === "All" || tx.owners === ownerFilter) && (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter))));
    txListContainer.innerHTML = "";
    if (filtered.length === 0) {
        txListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color: #999;">No transactions found.</td></tr>';
        markPaidBtn.disabled = true;
    } else {
        markPaidBtn.disabled = false;
        const allPaid = filtered.every(tx => tx.status === "paid");
        markPaidBtn.innerText = allPaid ? "Mark All as Unpaid" : "Mark All as Paid";
        markPaidBtn.style.backgroundColor = allPaid ? "#e67e22" : "#27ae60";
        markPaidBtn.dataset.action = allPaid ? "pending" : "paid";
    }

    filtered.forEach(tx => {
        const row = document.createElement("tr");
        row.className = "tx-row";
        row.style.borderBottom = "1px solid #eee";
        row.onclick = (e) => !e.target.closest("button") && openTxEditModal(tx);
        const actionsHtml = tx.status === "pending" ?
            `<button class="mark-paid-single-btn" style="padding: 2px 5px; font-size: 0.8rem; background-color: #27ae60; color: white; border: none; border-radius: 3px; cursor: pointer;">Mark Paid</button>` :
            `<button class="mark-unpaid-single-btn" style="padding: 2px 5px; font-size: 0.8rem; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer;">Mark Unpaid</button>`;
        row.innerHTML = `<td style="padding: 10px;">${tx.date}</td><td style="padding: 10px;">${tx.details}</td><td style="padding: 10px;">${tx.amount}</td><td style="padding: 10px;">${tx.owners || ""}</td><td style="padding: 10px;">${actionsHtml}</td>`;
        row.querySelector("button").onclick = () => {
            const newStatus = tx.status === "pending" ? "paid" : "pending";
            showNotification(`Mark as ${newStatus === "paid" ? "Paid" : "Unpaid"}?`, true, () => updateTransactionStatus(currentSourceId, tx.id, newStatus));
        };
        txListContainer.appendChild(row);
    });
}

function openTxEditModal(tx) {
    editingTransactionId = tx.id;
    editTxDate.value = tx.date; editTxCategory.value = tx.category; editTxAmount.value = tx.amount;
    editTxOwner.value = tx.owners; editTxDetails.value = tx.details; editTxComment.value = tx.comment || "";
    txEditModal.style.display = "block";
}

txEditForm.onsubmit = async (e) => {
    e.preventDefault();
    const updatedData = { date: editTxDate.value, category: editTxCategory.value, amount: Number(editTxAmount.value), owners: editTxOwner.value, details: editTxDetails.value, comment: editTxComment.value };
    try { await updateTransaction(currentSourceId, editingTransactionId, updatedData); showNotification("Updated!"); txEditModal.style.display = "none"; } catch (err) { showNotification("Failed."); }
};

deleteTxBtn.onclick = () => showNotification("Delete transaction?", true, async () => {
    try { await deleteTransaction(currentSourceId, editingTransactionId); showNotification("Deleted!"); txEditModal.style.display = "none"; } catch (err) { showNotification("Failed."); }
});

markPaidBtn.onclick = () => {
    const action = markPaidBtn.dataset.action;
    const ids = currentTransactions.filter(tx => (filterOwner.value === "All" || tx.owners === filterOwner.value) && (filterMonth.value === "All" || (tx.date && tx.date.startsWith(filterMonth.value)))).map(tx => tx.id);
    showNotification(`Mark ${ids.length} tx as ${action === "paid" ? "Paid" : "Unpaid"}?`, true, () => bulkUpdateTransactionStatus(currentSourceId, ids, action));
};

filterOwner.onchange = filterMonth.onchange = renderTransactions;
closeTxModalBtn.onclick = () => { txModal.style.display = "none"; if (txUnsubscribe) txUnsubscribe(); };
closeTxEditBtn.onclick = () => txEditModal.style.display = "none";
window.onclick = (e) => {
    if (e.target == txModal) { txModal.style.display = "none"; if (txUnsubscribe) txUnsubscribe(); }
    if (e.target == txEditModal) txEditModal.style.display = "none";
    if (e.target == alertModal) alertModal.style.display = "none";
};
