import { subscribeToItems, addTransaction, subscribeToTransactions, updateTransactionStatus, bulkUpdateTransactionStatus, updateTransaction, deleteTransaction, moveTransaction } from "./firebase-service.js";
import { Calculator } from "./calculator.js";
import { MultiAdder } from "./multi-adder.js";

const form = document.getElementById("add-form");
const loadingIndicator = document.getElementById("loading");

// Inputs
document.getElementById("input-date").valueAsDate = new Date();
const inputName = document.getElementById("input-name");
const inputDate = document.getElementById("input-date");
const inputDetails = document.getElementById("input-details");
const inputAmount = document.getElementById("input-amount");
const inputComment = document.getElementById("input-comment");
const inputCategory = document.getElementById("input-category");

// Category Definitions
const CATEGORIES = ["Grocery", "Pets", "Fuel", "Dining", "LIC/OICL", "Travel", "Entertainment", "Utility Bills", "Rent", "Other"];

// Populate dropdowns
inputCategory.innerHTML = `<option value="" disabled selected>Select Category...</option>` +
    CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

// DOM Selectors for transaction interactions
const closeTxModalBtn = document.querySelector(".close-transactions-btn");
const txListContainer = document.getElementById("transactions-list");
const txTitle = document.getElementById("transactions-title");
const filterOwner = document.getElementById("filter-owner");
const filterMonth = document.getElementById("filter-month");
const markPaidBtn = document.getElementById("mark-paid-btn");
let txUnsubscribe = null;
let currentTransactions = [];
let currentSourceId = null;
let ALL_SOURCE_IDS = []; // Track all source IDs for editing

// Edit Transaction Form Selectors
const txEditForm = document.getElementById("tx-edit-form");
const closeTxEditBtn = document.getElementById("close-tx-edit-btn");
const deleteTxBtn = document.getElementById("delete-tx-btn");

const editTxDate = document.getElementById("edit-tx-date");
const editTxSource = document.getElementById("edit-tx-source");
const editTxCategory = document.getElementById("edit-tx-category");
const editTxAmount = document.getElementById("edit-tx-amount");
const editTxOwner = document.getElementById("edit-tx-owner");
const editTxDetails = document.getElementById("edit-tx-details");
const editTxComment = document.getElementById("edit-tx-comment");

let editingTransactionId = null;
let currentTxStatus = "pending";

// Populate categories for edit modal
document.getElementById("edit-tx-category").innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

// Populate source dropdown for edit modal
const populateEditSources = () => {
    if (editTxSource && ALL_SOURCE_IDS.length > 0) {
        editTxSource.innerHTML = ALL_SOURCE_IDS.map(id => `<option value="${id}">${id}</option>`).join("");
    }
};

// Alert Modal Elements
const alertMessage = document.getElementById("alert-message");
const alertOkBtn = document.getElementById("alert-ok-btn");
const alertCancelBtn = document.getElementById("alert-cancel-btn");

// Bootstrap Modal Instances
let mainModal, txModal, txEditModal, alertModal, calculator, multiAdder;

document.addEventListener('DOMContentLoaded', () => {
    mainModal = new bootstrap.Modal(document.getElementById('expense-modal'));
    txModal = new bootstrap.Modal(document.getElementById('transactions-modal'));
    txEditModal = new bootstrap.Modal(document.getElementById('tx-edit-modal'));
    alertModal = new bootstrap.Modal(document.getElementById('alert-modal'));
    calculator = new Calculator();
    multiAdder = new MultiAdder();

    // Calculator button listener
    const openCalcBtn = document.getElementById('open-calc-btn');
    if (openCalcBtn) {
        openCalcBtn.onclick = () => {
            calculator.open(inputAmount.value || 0, (result) => {
                inputAmount.value = result;
            });
        };
    }

    // Multi-Adder button listener
    const openMultiAdderBtn = document.getElementById('open-multi-adder-btn');
    if (openMultiAdderBtn) {
        openMultiAdderBtn.onclick = () => {
            multiAdder.open(({ totalAmount, comment }) => {
                inputAmount.value = totalAmount;
                inputComment.value = comment;
            });
        };
    }
});

function showNotification(message, isConfirmation = false, onConfirmCallback = null) {
    alertMessage.textContent = message;

    alertOkBtn.onclick = () => {
        alertModal.hide();
        if (isConfirmation && onConfirmCallback) onConfirmCallback();
    };

    if (isConfirmation) {
        alertCancelBtn.style.display = "inline-block";
        alertCancelBtn.onclick = () => alertModal.hide();
    } else {
        alertCancelBtn.style.display = "none";
    }

    alertModal.show();
}

let sourceChart = null;

function updateSourceChart(items) {
    const canvas = document.getElementById('sourceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const filteredItems = items.filter(item => (item.totalOutstanding || 0) > 0);
    const labels = filteredItems.map(item => item.id);
    const actualData = filteredItems.map(item => item.totalOutstanding || 0);

    // Calculate Grand Totals for Summary Cards
    const totalSum = actualData.reduce((a, b) => a + b, 0);
    const totalOutstandingSum = items.reduce((a, b) => a + (b.outstanding || 0), 0);

    // Update Summary Cards in DOM
    const outstandingEl = document.getElementById("total-outstanding-val");
    const totalOutEl = document.getElementById("total-out-val");
    if (outstandingEl) outstandingEl.innerText = `₹${totalOutstandingSum.toLocaleString()}`;
    if (totalOutEl) totalOutEl.innerText = `₹${totalSum.toLocaleString()}`;

    const minVisualValue = totalSum * 0.03;
    const visualData = actualData.map(val => Math.max(val, minVisualValue));

    const colors = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c', '#34495e', '#d35400', '#27ae60'];

    if (sourceChart) {
        sourceChart.data.labels = labels;
        sourceChart.data.datasets[0].data = visualData;
        sourceChart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
        sourceChart.update();
    } else {
        sourceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: visualData,
                    backgroundColor: colors.slice(0, labels.length),
                    hoverOffset: 15,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const sourceId = labels[index];
                        openTransactionsModal(sourceId);
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: { padding: 20, usePointStyle: true, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const item = filteredItems[context.dataIndex];
                                return [
                                    `Total Out: ₹${(item.totalOutstanding || 0).toLocaleString()}`,
                                    `Pending:  ₹${(item.outstanding || 0).toLocaleString()}`
                                ];
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Source Distribution (Click to View)',
                        font: { size: 16, weight: 'bold' },
                        padding: { bottom: 10 }
                    }
                }
            }
        });
    }
}

function openTransactionsModal(sourceId) {
    currentSourceId = sourceId;
    txTitle.innerText = `Transactions: ${sourceId}`;
    txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';

    txModal.show();

    filterOwner.value = "All";
    filterMonth.innerHTML = '<option value="All">All Months</option>';
    if (txUnsubscribe) txUnsubscribe();
    txUnsubscribe = subscribeToTransactions(sourceId, (transactions) => {
        currentTransactions = transactions;
        populateMonthFilter(transactions);
        renderTransactions();
    }, (err) => {
        txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-danger">Failed to load transactions.</td></tr>';
    });
}

// Quick-Add button in transactions modal
const modalAddBtn = document.getElementById("modal-add-btn");
if (modalAddBtn) {
    modalAddBtn.onclick = () => {
        if (inputName) inputName.value = currentSourceId;
        if (inputDate) inputDate.valueAsDate = new Date();
        mainModal.show();
    };
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
    const filtered = currentTransactions.filter(tx =>
        (ownerFilter === "All" || tx.owners === ownerFilter) &&
        (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter)))
    );

    txListContainer.innerHTML = "";
    if (filtered.length === 0) {
        txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No transactions found.</td></tr>';
        markPaidBtn.disabled = true;
    } else {
        markPaidBtn.disabled = false;
        const allPaid = filtered.every(tx => tx.status === "paid");
        markPaidBtn.innerHTML = allPaid ?
            `<span class="material-icons me-1">history</span> Mark All as Unpaid` :
            `<span class="material-icons me-1">check_circle</span> Mark All as Paid`;

        markPaidBtn.classList.remove("btn-success", "btn-warning");
        markPaidBtn.classList.add(allPaid ? "btn-warning" : "btn-success");
        markPaidBtn.dataset.action = allPaid ? "pending" : "paid";
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
    txEditModal.show();
}

// Global Modal Elements for "Add Transaction"
const openMainModalBtn = document.getElementById("open-modal-btn");

// Event Listeners for Opening Modals
if (openMainModalBtn) {
    openMainModalBtn.onclick = () => {
        mainModal.show();
        if (!inputDate.value) inputDate.valueAsDate = new Date();
    };
}

// Handle unsubscription when the transactions modal is closed (any way: ESC, backdrop, or close button)
document.getElementById('transactions-modal').addEventListener('hidden.bs.modal', () => {
    if (txUnsubscribe) {
        txUnsubscribe();
        txUnsubscribe = null;
    }
});

form.onsubmit = async (e) => {
    e.preventDefault();
    const sourceId = inputName.value;
    const date = inputDate.value;
    const details = inputDetails.value.trim();
    const amount = Number(inputAmount.value);
    const category = inputCategory.value;
    const selectedOwner = document.querySelector('input[name="owner"]:checked');

    if (!sourceId || !date || !details || !amount || !category || !selectedOwner) {
        showNotification("Please fill in all required fields.");
        return;
    }

    const transactionData = {
        date, details, category, amount,
        comment: document.getElementById("input-comment").value.trim(),
        owners: selectedOwner.value,
        status: "pending",
        createdAt: new Date()
    };

    try {
        await addTransaction(sourceId, transactionData);
        showNotification("Transaction added successfully!");
        form.reset();
        mainModal.hide();
        document.getElementById("input-date").valueAsDate = new Date();
    } catch (error) {
        showNotification("Failed to add transaction.");
    }
};

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
            txEditModal.hide();
            txModal.hide(); // List is stale
        } else {
            await updateTransaction(currentSourceId, editingTransactionId, updatedData);
            showNotification("Updated!");
            txEditModal.hide();
        }
    } catch (err) {
        showNotification("Failed to save changes.");
    }
};

deleteTxBtn.onclick = () => {
    showNotification("Delete transaction forever?", true, async () => {
        try {
            await deleteTransaction(currentSourceId, editingTransactionId);
            showNotification("Deleted!");
            txEditModal.hide();
        } catch (err) {
            showNotification("Failed to delete.");
        }
    });
};

markPaidBtn.onclick = () => {
    const action = markPaidBtn.dataset.action;
    const ownerFilter = filterOwner.value;
    const monthFilter = filterMonth.value;
    const ids = currentTransactions
        .filter(tx =>
            (ownerFilter === "All" || tx.owners === ownerFilter) &&
            (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter)))
        )
        .map(tx => tx.id);

    showNotification(`Mark ${ids.length} transactions as ${action === "paid" ? "Paid" : "Unpaid"}?`, true, () =>
        bulkUpdateTransactionStatus(currentSourceId, ids, action)
    );
};

filterOwner.onchange = filterMonth.onchange = renderTransactions;

subscribeToItems((items) => {
    if (loadingIndicator) loadingIndicator.style.display = "none";
    ALL_SOURCE_IDS = items.map(i => i.id);
    populateEditSources();
    updateSourceChart(items);

    // Update main dropdown
    const currentSelection = inputName.value;
    inputName.innerHTML = `<option value="" disabled selected>Select Source...</option>` +
        items.map(i => `<option value="${i.id}">${i.id}</option>`).join("");
    if (currentSelection && items.some(i => i.id === currentSelection)) inputName.value = currentSelection;
}, (error) => {
    if (loadingIndicator) loadingIndicator.innerText = "Error loading data.";
});
