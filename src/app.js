import { subscribeToItems, deleteItem, updateItem, addTransaction, subscribeToTransactions, updateTransactionStatus, bulkUpdateTransactionStatus, updateTransaction, deleteTransaction } from "./firebase-service.js";

const form = document.getElementById("add-form");
const listContainer = document.getElementById("items-list");
const loadingIndicator = document.getElementById("loading");

var sourceList = [];

// Inputs
document.getElementById("input-date").valueAsDate = new Date();
const inputName = document.getElementById("input-name"); // Source Dropdown
const inputDate = document.getElementById("input-date");
const inputDetails = document.getElementById("input-details");
const inputAmount = document.getElementById("input-amount");
const inputComment = document.getElementById("input-comment");
const inputOwners = document.getElementsByName("owner");
const inputCategory = document.getElementById("input-category");

// Populate category dropdown
const CATEGORIES = [
    "Grocery",
    "Pets",
    "Fuel",
    "Dining",
    "LIC/OICL",
    "Travel",
    "Entertainment",
    "Utility Bills",
    "Rent",
    "Other"
];
inputCategory.innerHTML = `<option value="" disabled selected>Select Category...</option>` +
    CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

// Modal Elements
const modal = document.getElementById("expense-modal");
const openModalBtn = document.getElementById("open-modal-btn");
const closeModalBtn = document.querySelector(".close-btn");

// View Transactions Modal Elements
const txModal = document.getElementById("transactions-modal");
const closeTxModalBtn = document.querySelector(".close-transactions-btn");
const txListContainer = document.getElementById("transactions-list");
const txTitle = document.getElementById("transactions-title");
const filterOwner = document.getElementById("filter-owner");
const filterMonth = document.getElementById("filter-month");
const markPaidBtn = document.getElementById("mark-paid-btn");
const addTxFromModalBtn = document.getElementById("add-tx-from-modal-btn");
let txUnsubscribe = null;
let currentTransactions = []; // Store fetched transactions for filtering
let currentSourceId = null; // Store current source ID for updates

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
const populateEditCategories = () => {
    editTxCategory.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
};
populateEditCategories();

// Alert Modal Elements
const alertModal = document.getElementById("alert-modal");
const alertMessage = document.getElementById("alert-message");
const alertOkBtn = document.getElementById("alert-ok-btn");
const alertCancelBtn = document.getElementById("alert-cancel-btn");

let onAlertConfirm = null;

let sourceChart = null;

function updateSourceChart(items) {
    const ctx = document.getElementById('sourceChart').getContext('2d');

    // Filter out sources with 0 total outstanding
    const filteredItems = items.filter(item => (item.totalOutstanding || 0) > 0);

    const labels = filteredItems.map(item => item.id);
    const actualData = filteredItems.map(item => item.totalOutstanding || 0);

    // Calculate visual data with a minimum weight (e.g. 3% of total) for visibility
    const totalSum = actualData.reduce((a, b) => a + b, 0);
    const minVisualValue = totalSum * 0.03;
    const visualData = actualData.map(val => Math.max(val, minVisualValue));

    const colors = [
        '#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#f1c40f',
        '#e74c3c', '#1abc9c', '#34495e', '#d35400', '#27ae60'
    ];

    if (sourceChart) {
        sourceChart.data.labels = labels;
        sourceChart.data.datasets[0].data = visualData;
        sourceChart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
        // Store current items in chart instance for tooltip reference
        sourceChart.options.plugins.tooltip.externalData = filteredItems;
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
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = filteredItems[index];
                                const total = item.totalOutstanding || 0;
                                const pending = item.outstanding || 0;
                                return [
                                    `Total Out: ₹${total.toLocaleString()}`,
                                    `Pending:  ₹${pending.toLocaleString()}`
                                ];
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Source Distribution (Click to View)',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: { bottom: 10 }
                    }
                }
            }
        });
    }
}

function showNotification(message, isConfirmation = false, onConfirmCallback = null) {
    alertMessage.textContent = message;
    alertModal.style.display = "block";

    // Setup OK Button
    alertOkBtn.onclick = () => {
        alertModal.style.display = "none";
        if (isConfirmation && onConfirmCallback) {
            onConfirmCallback();
        }
    };

    // Setup Cancel Button
    if (isConfirmation) {
        alertCancelBtn.style.display = "inline-block";
        alertCancelBtn.onclick = () => {
            alertModal.style.display = "none";
        };
    } else {
        alertCancelBtn.style.display = "none";
    }
}

// Toggle Modal
openModalBtn.onclick = () => {
    modal.style.display = "block";
    // Set default date to today if empty
    if (!inputDate.value) {
        inputDate.valueAsDate = new Date();
    }
};
closeModalBtn.onclick = () => {
    modal.style.display = "none";
    modal.style.zIndex = "";
};

// Close Tx Modal
closeTxModalBtn.onclick = () => {
    txModal.style.display = "none";
    if (txUnsubscribe) txUnsubscribe();
};

// Add Transaction from within Transactions Modal
addTxFromModalBtn.onclick = () => {
    // Pre-select the current source in the dropdown
    if (currentSourceId) {
        inputName.value = currentSourceId;
    }
    // Set default date to today
    if (!inputDate.value) {
        inputDate.valueAsDate = new Date();
    }
    // Open on top of the transactions modal
    modal.style.zIndex = "1500";
    modal.style.display = "block";
};

window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
        modal.style.zIndex = "";
    }
    if (event.target == txModal) {
        txModal.style.display = "none";
        if (txUnsubscribe) txUnsubscribe();
    }
    if (event.target == txEditModal) {
        txEditModal.style.display = "none";
    }
}

closeTxEditBtn.onclick = () => {
    txEditModal.style.display = "none";
};

// Filter Event Listeners
filterOwner.addEventListener("change", renderTransactions);
filterMonth.addEventListener("change", renderTransactions);

// Bulk Mark as Paid/Unpaid
markPaidBtn.addEventListener("click", async () => {
    const action = markPaidBtn.dataset.action; // 'paid' or 'pending'
    const statusLabel = action === 'paid' ? 'Paid' : 'Unpaid (Pending)';
    const ids = currentTransactionsForBulk.map(tx => tx.id);

    if (ids.length === 0) return;

    showNotification(`Mark ${ids.length} transactions as ${statusLabel}?`, true, async () => {
        try {
            await bulkUpdateTransactionStatus(currentSourceId, ids, action);
            showNotification("Updated successfully!");
        } catch (e) {
            showNotification("Failed to update status.");
            console.error(e);
        }
    });
});

let currentTransactionsForBulk = [];

// State to track editing
let editingId = null;

// Initial Load / Subscription
subscribeToItems((items) => {
    loadingIndicator.style.display = "none";
    renderItems(items);
    updateNameDropdown(items);
}, (error) => {
    loadingIndicator.innerText = `Error loading data: ${error.message}`;
    loadingIndicator.style.color = "red";
    console.error("Subscription failed:", error);
});

// Update Dropdown Function
function updateNameDropdown(items) {
    // Keep the "Select Expense..." option
    const currentSelection = inputName.value;
    inputName.innerHTML = `<option value="" disabled selected>Select Source...</option>`;

    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.id;
        inputName.appendChild(option);
    });

    // Restore selection
    if (currentSelection && items.some(i => i.id === currentSelection)) {
        inputName.value = currentSelection;
    }
}

// Add Transaction (Sub-collection)
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sourceId = inputName.value;
    const date = inputDate.value;
    const details = inputDetails.value.trim();
    const amount = Number(inputAmount.value);
    const comment = inputComment.value.trim();
    const category = inputCategory.value;

    const selectedOwner = document.querySelector('input[name="owner"]:checked');

    if (!sourceId || !date || !details || !amount || !category) {
        showNotification("Please fill in all required fields.");
        return;
    }

    if (!selectedOwner) {
        showNotification("Please select an Owner.");
        return;
    }

    const transactionData = {
        date,
        details,
        category,
        amount,
        comment,
        owners: selectedOwner.value,
        status: "pending",
        createdAt: new Date()
    };

    try {
        // Use 'details' as the sub-collection name
        await addTransaction(sourceId, transactionData);

        showNotification("Transaction added successfully!");
        form.reset();
        modal.style.display = "none";
    } catch (error) {
        console.error(error);
        showNotification("Failed to add transaction. See console.");
    }
});

// Render Function
function renderItems(items) {
    listContainer.innerHTML = "";
    updateSourceChart(items);

    if (items.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding:15px;">No expenses found.</td></tr>`;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement("tr");
        tr.dataset.id = item.id;
        sourceList.push(item.id);
        if (editingId === item.id) {
            // Edit Mode - Table Row
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><input type="number" class="edit-outstanding edit-input-table" value="${item.outstanding || 0}"></td>
                <td><input type="number" class="edit-total edit-input-table" value="${item.totalOutstanding || 0}"></td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="save-btn" style="padding:5px 8px; font-size:0.8rem;">Save</button>
                        <button class="cancel-btn" style="background:#dc3545; padding:5px 8px; font-size:0.8rem;">Cancel</button>
                    </div>
                </td>
            `;

            // Handle Save
            tr.querySelector(".save-btn").addEventListener("click", async () => {
                const updatedData = {
                    outstanding: Number(tr.querySelector(".edit-outstanding").value),
                    totalOutstanding: Number(tr.querySelector(".edit-total").value)
                };

                await updateItem(item.id, updatedData);
                editingId = null;
            });

            // Handle Cancel
            tr.querySelector(".cancel-btn").addEventListener("click", () => {
                editingId = null;
                renderItems(items);
            });

        } else {
            // View Mode - Table Row
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

            // View Action
            tr.querySelector(".view-btn").addEventListener("click", () => {
                openTransactionsModal(item.id);
            });

        }

        listContainer.appendChild(tr);
    });
}

function openTransactionsModal(sourceId) {
    currentSourceId = sourceId;
    txTitle.innerText = `Transactions: ${sourceId}`;
    txListContainer.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:15px;">Loading...</td></tr>';
    txModal.style.display = "block";

    // Reset filters
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
    transactions.forEach(tx => {
        if (tx.date) {
            // date is YYYY-MM-DD
            const monthStr = tx.date.substring(0, 7); // YYYY-MM
            months.add(monthStr);
        }
    });

    // Convert to array and sort descending
    const sortedMonths = Array.from(months).sort().reverse();

    filterMonth.innerHTML = '<option value="All">All Months</option>';
    sortedMonths.forEach(m => {
        const option = document.createElement("option");
        option.value = m;
        option.textContent = m; // Maybe format later (e.g. Feb 2026)
        filterMonth.appendChild(option);
    });
}

function renderTransactions() {
    const ownerFilter = filterOwner.value;
    const monthFilter = filterMonth.value;

    const filtered = currentTransactions.filter(tx => {
        const matchOwner = ownerFilter === "All" || tx.owners === ownerFilter;
        const matchMonth = monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter));
        return matchOwner && matchMonth;
    });

    txListContainer.innerHTML = "";

    const allPaid = filtered.every(tx => tx.status === "paid");
    currentTransactionsForBulk = filtered;

    if (filtered.length === 0) {
        txListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color: #999;">No transactions found.</td></tr>';
        markPaidBtn.disabled = true;
        markPaidBtn.style.opacity = "0.5";
        markPaidBtn.style.cursor = "not-allowed";
        return;
    } else {
        markPaidBtn.disabled = false;
        markPaidBtn.style.opacity = "1";
        markPaidBtn.style.cursor = "pointer";

        if (allPaid) {
            markPaidBtn.innerText = "Mark All as Unpaid";
            markPaidBtn.style.backgroundColor = "#e67e22"; // Orange
            markPaidBtn.dataset.action = "pending";
        } else {
            markPaidBtn.innerText = "Mark All as Paid";
            markPaidBtn.style.backgroundColor = "#27ae60"; // Green
            markPaidBtn.dataset.action = "paid";
        }
    }

    filtered.forEach(tx => {
        const row = document.createElement("tr");
        row.className = "tx-row";
        row.style.borderBottom = "1px solid #eee";

        row.onclick = (e) => {
            // Don't open if they clicked the Mark Paid button
            if (e.target.closest("button")) return;
            openTxEditModal(tx);
        };

        let actionsHtml = "";
        if (tx.status === "pending") {
            actionsHtml = `<button class="mark-paid-single-btn" data-id="${tx.id}" style="padding: 2px 5px; font-size: 0.8rem; background-color: #27ae60; color: white; border: none; border-radius: 3px; cursor: pointer;">Mark Paid</button>`;
        } else {
            actionsHtml = `<button class="mark-unpaid-single-btn" data-id="${tx.id}" style="padding: 2px 5px; font-size: 0.8rem; background-color: #e67e22; color: white; border: none; border-radius: 3px; cursor: pointer;">Mark Unpaid</button>`;
        }

        row.innerHTML = `
            <td style="padding: 10px;">${tx.date}</td>
            <td style="padding: 10px;">${tx.details}</td>
            <td style="padding: 10px;">${tx.amount}</td>
            <td style="padding: 10px;">${tx.owners || ""}</td>
             <td style="padding: 10px;">${actionsHtml}</td>
        `;

        if (tx.status === "pending") {
            const btn = row.querySelector(".mark-paid-single-btn");
            btn.addEventListener("click", async () => {
                showNotification("Mark this transaction as Paid?", true, async () => {
                    await updateTransactionStatus(currentSourceId, tx.id, "paid");
                });
            });
        } else {
            const btn = row.querySelector(".mark-unpaid-single-btn");
            btn.addEventListener("click", async () => {
                showNotification("Mark this transaction as Unpaid (Pending)?", true, async () => {
                    await updateTransactionStatus(currentSourceId, tx.id, "pending");
                });
            });
        }

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
        showNotification("Transaction updated successfully!");
        txEditModal.style.display = "none";
    } catch (err) {
        console.error(err);
        showNotification("Update failed.");
    }
};

deleteTxBtn.onclick = () => {
    showNotification("Delete this transaction forever?", true, async () => {
        try {
            await deleteTransaction(currentSourceId, editingTransactionId);
            showNotification("Transaction deleted.");
            txEditModal.style.display = "none";
        } catch (err) {
            console.error(err);
            showNotification("Delete failed.");
        }
    });
};
