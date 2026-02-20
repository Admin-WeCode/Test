import { subscribeToItems, updateItem, subscribeToTransactions, updateTransactionStatus, bulkUpdateTransactionStatus, updateTransaction, deleteTransaction, moveTransaction, addTransaction } from "./firebase-service.js";
import { Calculator } from "./calculator.js";
import { MultiAdder } from "./multi-adder.js";
import { CATEGORIES, setupNotification, initCommonModals, setupUtilityButtons, populateSelect, injectSharedModals } from "./ui-utils.js";

injectSharedModals();

const listContainer = document.getElementById("items-list");
const loadingIndicator = document.getElementById("loading");

// Bootstrap Modal Instances
let modals = {};
let calculator, multiAdder, showNotification;

document.addEventListener('DOMContentLoaded', () => {
    modals = initCommonModals(['transactions-modal', 'tx-edit-modal', 'alert-modal', 'expense-modal']);
    calculator = new Calculator();
    multiAdder = new MultiAdder();

    showNotification = setupNotification(modals['alert-modal'], alertMessage, alertOkBtn, alertCancelBtn);

    setupUtilityButtons(calculator, multiAdder, inputAmount, inputComment);
});

// Selectors for Modal Elements
const txListContainer = document.getElementById("transactions-list");
const txTitle = document.getElementById("transactions-title");
const filterOwner = document.getElementById("filter-owner");
const filterMonth = document.getElementById("filter-month");
const markPaidBtn = document.getElementById("mark-paid-btn");

const txEditForm = document.getElementById("tx-edit-form");
const deleteTxBtn = document.getElementById("delete-tx-btn");

const editTxDate = document.getElementById("edit-tx-date");
const editTxSource = document.getElementById("edit-tx-source");
const editTxCategory = document.getElementById("edit-tx-category");
const editTxAmount = document.getElementById("edit-tx-amount");
const editTxOwner = document.getElementById("edit-tx-owner");
const editTxDetails = document.getElementById("edit-tx-details");
const editTxComment = document.getElementById("edit-tx-comment");

// Selectors for Add Modal
const form = document.getElementById("add-form");
const inputName = document.getElementById("input-name");
const inputDate = document.getElementById("input-date");
const inputDetails = document.getElementById("input-details");
const inputAmount = document.getElementById("input-amount");
const inputComment = document.getElementById("input-comment");
const inputCategory = document.getElementById("input-category");

const alertMessage = document.getElementById("alert-message");
const alertOkBtn = document.getElementById("alert-ok-btn");
const alertCancelBtn = document.getElementById("alert-cancel-btn");

// State Variables
let txUnsubscribe = null;
let currentTransactions = [];
let ALL_SOURCE_IDS = []; // Global list for the dropdown
let currentSourceId = null;
let editingTransactionId = null;
let currentTxStatus = "pending";

// CATEGORIES imported from ui-utils.js

// Populate categories for edit modal
const populateEditCategories = () => {
    populateSelect(editTxCategory, CATEGORIES);
    populateSelect(inputCategory, CATEGORIES, "Select Category...");
};
populateEditCategories();

// Populate source dropdown
const populateEditSources = () => {
    if (ALL_SOURCE_IDS.length > 0) {
        populateSelect(editTxSource, ALL_SOURCE_IDS);
        populateSelect(inputName, ALL_SOURCE_IDS, "Source...");
    }
};

// showNotification defined via setupNotification in DOMContentLoaded

// Subscribe to items for the table
subscribeToItems((items) => {
    if (loadingIndicator) loadingIndicator.style.display = "none";
    ALL_SOURCE_IDS = items.map(i => i.id);
    populateEditSources();
    renderItems(items);

    // Deep Linking: Check for source parameter and auto-open modal
    const urlParams = new URLSearchParams(window.location.search);
    const sourceParam = urlParams.get('source');
    if (sourceParam && items.some(item => item.id === sourceParam)) {
        openTransactionsModal(sourceParam);
        // Clean up URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

function renderItems(items) {
    if (!listContainer) return;
    listContainer.innerHTML = "";
    if (items.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="3" class="text-center p-5 text-muted">No sources found.</td></tr>`;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.onclick = () => openTransactionsModal(item.id);
        tr.innerHTML = `
            <td class="ps-4 fw-bold text-primary">${item.id}</td>
            <td class="text-end fw-medium">₹${(item.outstanding || 0).toLocaleString()}</td>
            <td class="text-end pe-4 fw-bold">₹${(item.totalOutstanding || 0).toLocaleString()}</td>
        `;
        listContainer.appendChild(tr);
    });
}

function openTransactionsModal(sourceId) {
    currentSourceId = sourceId;
    if (txTitle) txTitle.innerText = `Transactions: ${sourceId}`;
    if (txListContainer) txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';

    if (modals['transactions-modal']) modals['transactions-modal'].show();

    if (filterOwner) filterOwner.value = "All";
    if (filterMonth) filterMonth.innerHTML = '<option value="All">All Months</option>';

    if (txUnsubscribe) txUnsubscribe();
    txUnsubscribe = subscribeToTransactions(sourceId, (transactions) => {
        currentTransactions = transactions;
        populateMonthFilter(transactions);
        renderTransactions();
    });
}

// Quick-Add button in transactions modal
const modalAddBtn = document.getElementById("modal-add-btn");
if (modalAddBtn) {
    modalAddBtn.onclick = () => {
        if (inputName) inputName.value = currentSourceId;
        if (inputDate) inputDate.valueAsDate = new Date();
        if (modals['expense-modal']) modals['expense-modal'].show();
    };
}

function populateMonthFilter(transactions) {
    if (!filterMonth) return;
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
    if (!txListContainer) return;
    const ownerFilter = filterOwner ? filterOwner.value : "All";
    const monthFilter = filterMonth ? filterMonth.value : "All";
    const filtered = currentTransactions.filter(tx =>
        (ownerFilter === "All" || tx.owners === ownerFilter) &&
        (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter)))
    );

    txListContainer.innerHTML = "";
    if (filtered.length === 0) {
        txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No transactions found.</td></tr>';
        if (markPaidBtn) markPaidBtn.disabled = true;
    } else {
        if (markPaidBtn) {
            markPaidBtn.disabled = false;
            const allPaid = filtered.every(tx => tx.status === "paid");
            markPaidBtn.innerHTML = allPaid ?
                `<span class="material-icons me-1">history</span> Mark All as Unpaid` :
                `<span class="material-icons me-1">check_circle</span> Mark All as Paid`;

            markPaidBtn.classList.remove("btn-success", "btn-warning");
            markPaidBtn.classList.add(allPaid ? "btn-warning" : "btn-success");
            markPaidBtn.dataset.action = allPaid ? "pending" : "paid";
        }
    }

    filtered.forEach(tx => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.onclick = (e) => !e.target.closest("button") && openTxEditModal(tx);

        const icon = tx.status === "paid" ? "check_circle" : "pending";

        row.innerHTML = `
            <td>${tx.date}</td>
            <td class="fw-medium">${tx.details}</td>
            <td class="fw-bold text-dark">₹${(tx.amount || 0).toLocaleString()}</td>
            <td><span class="badge bg-light text-dark border">${tx.owners || ""}</span></td>
            <td class="text-end">
                <button class="btn btn-sm ${tx.status === "pending" ? 'btn-success' : 'btn-warning'} py-1 px-2">
                    <span class="material-icons align-middle" style="font-size: 1.1rem;">${icon}</span>
                </button>
            </td>
        `;

        row.querySelector("button").onclick = (e) => {
            e.stopPropagation();
            const newStatus = tx.status === "pending" ? "paid" : "pending";
            showNotification(`Mark as ${newStatus === "paid" ? "Paid" : "Unpaid"}?`, true, () => updateTransactionStatus(currentSourceId, tx.id, newStatus));
        };
        txListContainer.appendChild(row);
    });
}

function openTxEditModal(tx) {
    editingTransactionId = tx.id;
    currentTxStatus = tx.status || "pending";
    if (editTxDate) editTxDate.value = tx.date;
    if (editTxSource) editTxSource.value = currentSourceId;
    if (editTxCategory) editTxCategory.value = tx.category || "Other";
    if (editTxAmount) editTxAmount.value = tx.amount;
    if (editTxOwner) editTxOwner.value = tx.owners || "Home";
    if (editTxDetails) editTxDetails.value = tx.details;
    if (editTxComment) editTxComment.value = tx.comment || "";
    if (modals['tx-edit-modal']) modals['tx-edit-modal'].show();
}

if (form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const sourceId = inputName.value;
        const selectedOwner = document.querySelector('input[name="owner"]:checked');
        const transactionData = {
            date: inputDate.value,
            details: inputDetails.value.trim(),
            category: inputCategory.value,
            amount: Number(inputAmount.value),
            comment: inputComment.value.trim(),
            owners: selectedOwner ? selectedOwner.value : "Home",
            status: "pending",
            createdAt: new Date()
        };
        try {
            await addTransaction(sourceId, transactionData);
            showNotification("Added!");
            form.reset();
            if (modals['expense-modal']) modals['expense-modal'].hide();
        } catch (error) {
            showNotification("Failed to add.");
        }
    };
}

if (txEditForm) {
    txEditForm.onsubmit = async (e) => {
        e.preventDefault();
        const newSourceId = editTxSource.value;
        const updatedData = {
            date: editTxDate.value,
            category: editTxCategory.value,
            amount: Number(editTxAmount.value),
            owners: editTxOwner.value,
            details: editTxDetails.value,
            comment: editTxComment.value,
            status: currentTxStatus
        };
        try {
            if (newSourceId !== currentSourceId) {
                await moveTransaction(currentSourceId, newSourceId, editingTransactionId, updatedData);
                showNotification("Moved & Updated!");
                modals['tx-edit-modal'].hide();
                modals['transactions-modal'].hide(); // Hide the list modal as it's now stale
            } else {
                await updateTransaction(currentSourceId, editingTransactionId, updatedData);
                showNotification("Updated!");
                modals['tx-edit-modal'].hide();
            }
        } catch (err) {
            showNotification("Failed to save changes.");
        }
    };
}

if (deleteTxBtn) {
    deleteTxBtn.onclick = () => showNotification("Delete transaction forever?", true, async () => {
        try {
            await deleteTransaction(currentSourceId, editingTransactionId);
            showNotification("Deleted!");
            modals['tx-edit-modal'].hide();
        } catch (err) {
            showNotification("Failed to delete.");
        }
    });
}

if (markPaidBtn) {
    markPaidBtn.onclick = () => {
        const action = markPaidBtn.dataset.action;
        const ids = currentTransactions
            .filter(tx => (filterOwner.value === "All" || tx.owners === filterOwner.value) && (filterMonth.value === "All" || (tx.date && tx.date.startsWith(filterMonth.value))))
            .map(tx => tx.id);

        showNotification(`Mark ${ids.length} transactions as ${action === "paid" ? "Paid" : "Unpaid"}?`, true, () => bulkUpdateTransactionStatus(currentSourceId, ids, action));
    };
}

if (filterOwner) filterOwner.onchange = renderTransactions;
if (filterMonth) filterMonth.onchange = renderTransactions;
