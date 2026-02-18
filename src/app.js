import { subscribeToItems, addTransaction, subscribeToTransactions, updateTransactionStatus, bulkUpdateTransactionStatus, updateTransaction, deleteTransaction } from "./firebase-service.js";

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

// Populate categories for edit modal
document.getElementById("edit-tx-category").innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

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

let sourceChart = null;

function updateSourceChart(items) {
    const canvas = document.getElementById('sourceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const filteredItems = items.filter(item => (item.totalOutstanding || 0) > 0);
    const labels = filteredItems.map(item => item.id);
    const actualData = filteredItems.map(item => item.totalOutstanding || 0);
    const totalSum = actualData.reduce((a, b) => a + b, 0);
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
                        position: 'right',
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
    txListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">Loading...</td></tr>';
    txModal.style.display = "block";
    filterOwner.value = "All";
    filterMonth.innerHTML = '<option value="All">All Months</option>';
    if (txUnsubscribe) txUnsubscribe();
    txUnsubscribe = subscribeToTransactions(sourceId, (transactions) => {
        currentTransactions = transactions;
        populateMonthFilter(transactions);
        renderTransactions();
    }, (err) => {
        txListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:red;">Failed to load transactions.</td></tr>';
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
    const filtered = currentTransactions.filter(tx =>
        (ownerFilter === "All" || tx.owners === ownerFilter) &&
        (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter)))
    );

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

        row.innerHTML = `
            <td style="padding: 10px;">${tx.date}</td>
            <td style="padding: 10px;">${tx.details}</td>
            <td style="padding: 10px;">₹${(tx.amount || 0).toLocaleString()}</td>
            <td style="padding: 10px;">${tx.owners || ""}</td>
            <td style="padding: 10px;">${actionsHtml}</td>
        `;

        row.querySelector("button").onclick = () => {
            const newStatus = tx.status === "pending" ? "paid" : "pending";
            showNotification(`Mark as ${newStatus === "paid" ? "Paid" : "Unpaid"}?`, true, () => updateTransactionStatus(currentSourceId, tx.id, newStatus));
        };
        txListContainer.appendChild(row);
    });
}

function openTxEditModal(tx) {
    editingTransactionId = tx.id;
    editTxDate.value = tx.date;
    editTxCategory.value = tx.category;
    editTxAmount.value = tx.amount;
    editTxOwner.value = tx.owners;
    editTxDetails.value = tx.details;
    editTxComment.value = tx.comment || "";
    txEditModal.style.display = "block";
}

// Global Modal Elements for "Add Expense" (Wait, Add Expense is actually Add Transaction in this app)
const mainModal = document.getElementById("expense-modal");
const openMainModalBtn = document.getElementById("open-modal-btn");
const closeMainModalBtn = document.querySelector(".close-btn");

// Event Listeners
openMainModalBtn.onclick = () => {
    mainModal.style.display = "block";
    if (!inputDate.value) inputDate.valueAsDate = new Date();
};
closeMainModalBtn.onclick = () => mainModal.style.display = "none";

closeTxModalBtn.onclick = () => {
    txModal.style.display = "none";
    if (txUnsubscribe) txUnsubscribe();
};

closeTxEditBtn.onclick = () => txEditModal.style.display = "none";

window.onclick = (event) => {
    if (event.target == mainModal) mainModal.style.display = "none";
    if (event.target == txModal) {
        txModal.style.display = "none";
        if (txUnsubscribe) txUnsubscribe();
    }
    if (event.target == txEditModal) txEditModal.style.display = "none";
    if (event.target == alertModal) alertModal.style.display = "none";
};

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
        mainModal.style.display = "none";
        document.getElementById("input-date").valueAsDate = new Date();
    } catch (error) {
        showNotification("Failed to add transaction.");
    }
};

txEditForm.onsubmit = async (e) => {
    e.preventDefault();
    const updatedData = {
        date: editTxDate.value,
        category: editTxCategory.value,
        amount: Number(editTxAmount.value),
        owners: editTxOwner.value,
        details: editTxDetails.value,
        comment: editTxComment.value
    };
    try {
        await updateTransaction(currentSourceId, editingTransactionId, updatedData);
        showNotification("Updated!");
        txEditModal.style.display = "none";
    } catch (err) {
        showNotification("Failed to update.");
    }
};

deleteTxBtn.onclick = () => {
    showNotification("Delete transaction forever?", true, async () => {
        try {
            await deleteTransaction(currentSourceId, editingTransactionId);
            showNotification("Deleted!");
            txEditModal.style.display = "none";
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
    updateSourceChart(items);

    // Update dropdown
    const currentSelection = inputName.value;
    inputName.innerHTML = `<option value="" disabled selected>Select Source...</option>` +
        items.map(i => `<option value="${i.id}">${i.id}</option>`).join("");
    if (currentSelection && items.some(i => i.id === currentSelection)) inputName.value = currentSelection;
}, (error) => {
    if (loadingIndicator) loadingIndicator.innerText = "Error loading data.";
});
