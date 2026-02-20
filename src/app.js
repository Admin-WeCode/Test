import { subscribeToItems, addTransaction, subscribeToTransactions, updateTransactionStatus, bulkUpdateTransactionStatus, updateTransaction, deleteTransaction, moveTransaction, fetchAllTransactions } from "./firebase-service.js";
import { Calculator } from "./calculator.js";
import { MultiAdder } from "./multi-adder.js";
import { CATEGORIES, setupNotification, initCommonModals, setupUtilityButtons, populateSelect, injectSharedModals } from "./ui-utils.js";

injectSharedModals();

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
// CATEGORIES imported from ui-utils.js

// Populate dropdowns
populateSelect(inputCategory, CATEGORIES, "Select Category...");

// DOM Selectors for transaction interactions
const txListContainer = document.getElementById("transactions-list");
const txTitle = document.getElementById("transactions-title");
const filterOwner = document.getElementById("filter-owner");
const filterMonth = document.getElementById("filter-month");
const markPaidBtn = document.getElementById("mark-paid-btn");
const multiSourceFilter = document.getElementById("multi-source-filter");
const modalTotalFooter = document.getElementById("modal-total-footer");
const grandTotalVal = document.getElementById("grand-total-val");
const outstandingTotalVal = document.getElementById("outstanding-total-val");

let txUnsubscribe = null;
let currentTransactions = [];
let currentSourceId = null;
let ALL_SOURCE_IDS = []; // Track all source IDs for editing
let selectedSources = new Set();

// Edit Transaction Form Selectors
const txEditForm = document.getElementById("tx-edit-form");
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
populateSelect(document.getElementById("edit-tx-category"), CATEGORIES);

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
let modals = {};
let calculator, multiAdder, showNotification;

document.addEventListener('DOMContentLoaded', () => {
    modals = initCommonModals(['expense-modal', 'transactions-modal', 'tx-edit-modal', 'alert-modal']);
    calculator = new Calculator();
    multiAdder = new MultiAdder();

    showNotification = setupNotification(modals['alert-modal'], alertMessage, alertOkBtn, alertCancelBtn);

    setupUtilityButtons(calculator, multiAdder, inputAmount, inputComment);
});

// showNotification defined via setupNotification in DOMContentLoaded

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

    modals['transactions-modal'].show();

    // Toggle Source column off
    const sourceCols = document.querySelectorAll('.col-source');
    sourceCols.forEach(el => el.style.display = 'none');
    if (multiSourceFilter) multiSourceFilter.style.display = 'none';
    if (modalTotalFooter) modalTotalFooter.style.display = 'none';

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

// Global All Transactions Modal
async function openAllTransactionsModal() {
    currentSourceId = "All";
    txTitle.innerText = "All Transactions";
    txListContainer.innerHTML = '<tr><td colspan="6" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';

    modals['transactions-modal'].show();

    // UI Toggles for Global View
    const sourceCols = document.querySelectorAll('.col-source');
    sourceCols.forEach(el => el.style.display = '');
    if (multiSourceFilter) multiSourceFilter.style.display = '';
    if (modalTotalFooter) modalTotalFooter.style.display = '';

    if (txUnsubscribe) {
        txUnsubscribe();
        txUnsubscribe = null;
    }

    await fetchAndRenderGlobalTransactions(true);
}

async function fetchAndRenderGlobalTransactions(resetFilters = false) {
    try {
        currentTransactions = await fetchAllTransactions(ALL_SOURCE_IDS);

        // Sorting by date descending as requested
        currentTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Save current selections if not resetting
        const prevMonth = filterMonth ? filterMonth.value : null;
        const prevOwner = filterOwner ? filterOwner.value : null;

        populateMonthFilter(currentTransactions);

        if (resetFilters) {
            selectedSources = new Set(ALL_SOURCE_IDS);
            if (filterOwner) filterOwner.value = "Home";
            if (filterMonth) {
                const now = new Date().toISOString().substring(0, 7);
                filterMonth.value = filterMonth.querySelector(`option[value="${now}"]`) ? now : "All";
            }
        } else {
            // Restore selections if possible
            if (prevOwner && filterOwner) filterOwner.value = prevOwner;
            if (prevMonth && filterMonth) {
                const exists = Array.from(filterMonth.options).some(opt => opt.value === prevMonth);
                if (exists) filterMonth.value = prevMonth;
            }
        }

        renderSourceFilter();
        renderTransactions();
    } catch (err) {
        console.error("Failed to fetch all transactions:", err);
        txListContainer.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-danger">Failed to load transactions.</td></tr>';
    }
}

function renderSourceFilter() {
    if (!multiSourceFilter) return;
    multiSourceFilter.innerHTML = `
        <div class="dropdown w-100">
            <button class="btn btn-white border shadow-sm dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-bs-auto-close="outside">
                <span class="text-truncate">Sources (${selectedSources.size})</span>
            </button>
            <ul class="dropdown-menu shadow-lg w-100 py-2">
                <li>
                    <div class="dropdown-item py-1">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="source-all" ${selectedSources.size === ALL_SOURCE_IDS.length ? 'checked' : ''}>
                            <label class="form-check-label fw-bold" for="source-all">Select All</label>
                        </div>
                    </div>
                </li>
                <li><hr class="dropdown-divider"></li>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${ALL_SOURCE_IDS.map(id => `
                        <li>
                            <div class="dropdown-item py-1">
                                <div class="form-check">
                                    <input class="form-check-input source-cb" type="checkbox" value="${id}" id="src-${id}" ${selectedSources.has(id) ? 'checked' : ''}>
                                    <label class="form-check-label" for="src-${id}">${id}</label>
                                </div>
                            </div>
                        </li>
                    `).join("")}
                </div>
            </ul>
        </div>
    `;

    // Listeners
    const allCb = document.getElementById("source-all");
    const sourceCbs = document.querySelectorAll(".source-cb");

    if (allCb) {
        allCb.onchange = (e) => {
            if (e.target.checked) {
                ALL_SOURCE_IDS.forEach(id => selectedSources.add(id));
            } else {
                selectedSources.clear();
            }
            sourceCbs.forEach(cb => cb.checked = e.target.checked);
            updateSourceFilterLabel();
            renderTransactions();
        };
    }

    sourceCbs.forEach(cb => {
        cb.onchange = (e) => {
            if (e.target.checked) selectedSources.add(e.target.value);
            else selectedSources.delete(e.target.value);
            if (allCb) allCb.checked = selectedSources.size === ALL_SOURCE_IDS.length;
            updateSourceFilterLabel();
            renderTransactions();
        };
    });
}

function updateSourceFilterLabel() {
    if (!multiSourceFilter) return;
    const label = multiSourceFilter.querySelector(".text-truncate");
    if (label) label.innerText = `Sources (${selectedSources.size})`;
}

// Quick-Add button in transactions modal
const modalAddBtn = document.getElementById("modal-add-btn");
if (modalAddBtn) {
    modalAddBtn.onclick = () => {
        if (inputName) {
            if (currentSourceId && currentSourceId !== "All") {
                inputName.value = currentSourceId;
            } else {
                inputName.selectedIndex = 0;
            }
        }
        if (inputDate) inputDate.valueAsDate = new Date();
        modals['expense-modal'].show();
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
    const isGlobal = currentSourceId === "All";

    const filtered = currentTransactions.filter(tx =>
        (ownerFilter === "All" || tx.owners === ownerFilter) &&
        (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter))) &&
        (!isGlobal || selectedSources.has(tx.sourceId))
    );

    // Sorting by date (fallback if not already sorted)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    txListContainer.innerHTML = "";
    const colCount = isGlobal ? 6 : 5;

    // Calculate Grand Total
    const total = filtered.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    if (grandTotalVal) grandTotalVal.innerText = `₹${total.toLocaleString()}`;

    // Calculate Outstanding Total (Unpaid)
    const outstanding = filtered.filter(tx => tx.status !== "paid")
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    if (outstandingTotalVal) outstandingTotalVal.innerText = `₹${outstanding.toLocaleString()}`;

    if (filtered.length === 0) {
        txListContainer.innerHTML = `<tr><td colspan="${colCount}" class="text-center p-5 text-muted">No transactions found.</td></tr>`;
        markPaidBtn.disabled = true;
    } else {
        markPaidBtn.disabled = false;
        const allPaid = filtered.every(tx => tx.status === "paid");
        markPaidBtn.innerHTML = allPaid ?
            `<span class="material-icons me-1">history</span> Mark All` :
            `<span class="material-icons me-1">check_circle</span> Mark All`;

        markPaidBtn.classList.remove("btn-success", "btn-warning");
        markPaidBtn.classList.add(allPaid ? "btn-warning" : "btn-success");
        markPaidBtn.dataset.action = allPaid ? "pending" : "paid";
    }

    filtered.forEach(tx => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.onclick = (e) => !e.target.closest("button") && openTxEditModal(tx, isGlobal ? tx.sourceId : currentSourceId);

        const icon = tx.status === "paid" ? "check_circle" : "pending";

        row.innerHTML = `
            <td>${tx.date}</td>
            ${isGlobal ? `<td class="col-source"><span class="badge bg-light text-dark border">${tx.sourceId}</span></td>` : ''}
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
            const sid = isGlobal ? tx.sourceId : currentSourceId;
            const newStatus = tx.status === "pending" ? "paid" : "pending";
            showNotification(`Mark as ${newStatus === "paid" ? "Paid" : "Unpaid"}?`, true, async () => {
                await updateTransactionStatus(sid, tx.id, newStatus);
                if (isGlobal) {
                    // Update local state and re-render
                    tx.status = newStatus;
                    renderTransactions();
                }
            });
        };
        txListContainer.appendChild(row);
    });
}

function openTxEditModal(tx, sourceId) {
    editingTransactionId = tx.id;
    currentSourceIdForEdit = sourceId; // Track which source we're editing
    currentTxStatus = tx.status || "pending";
    if (editTxDate) editTxDate.value = tx.date;
    if (editTxSource) editTxSource.value = sourceId;
    if (editTxCategory) editTxCategory.value = tx.category || "Other";
    if (editTxAmount) editTxAmount.value = tx.amount;
    if (editTxOwner) editTxOwner.value = tx.owners || "Home";
    if (editTxDetails) editTxDetails.value = tx.details;
    if (editTxComment) editTxComment.value = tx.comment || "";
    modals['tx-edit-modal'].show();
}

let currentSourceIdForEdit = null;

// Global Modal Elements for "Add Transaction"
const openMainModalBtn = document.getElementById("open-modal-btn");
const openAllTxBtn = document.getElementById("open-all-tx-btn");

// Event Listeners for Opening Modals
if (openMainModalBtn) {
    openMainModalBtn.onclick = () => {
        modals['expense-modal'].show();
        if (!inputDate.value) inputDate.valueAsDate = new Date();
    };
}

if (openAllTxBtn) {
    openAllTxBtn.onclick = openAllTransactionsModal;
}

// Handle unsubscription when the transactions modal is closed
document.getElementById('transactions-modal')?.addEventListener('hidden.bs.modal', () => {
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
        modals['expense-modal'].hide();
        document.getElementById("input-date").valueAsDate = new Date();
        if (currentSourceId === "All") fetchAndRenderGlobalTransactions(false); // Preserve filters
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
        if (newSourceId !== currentSourceIdForEdit) {
            await moveTransaction(currentSourceIdForEdit, newSourceId, editingTransactionId, updatedData);
            showNotification("Moved & Updated!");
            modals['tx-edit-modal'].hide();
            modals['transactions-modal'].hide();
        } else {
            await updateTransaction(currentSourceIdForEdit, editingTransactionId, updatedData);
            showNotification("Updated!");
            modals['tx-edit-modal'].hide();
            if (currentSourceId === "All") fetchAndRenderGlobalTransactions(false); // Preserve filters
        }
    } catch (err) {
        showNotification("Failed to save changes.");
    }
};

deleteTxBtn.onclick = () => {
    showNotification("Delete transaction forever?", true, async () => {
        try {
            await deleteTransaction(currentSourceIdForEdit, editingTransactionId);
            showNotification("Deleted!");
            modals['tx-edit-modal'].hide();
            if (currentSourceId === "All") fetchAndRenderGlobalTransactions(false); // Preserve filters
        } catch (err) {
            showNotification("Failed to delete.");
        }
    });
};

markPaidBtn.onclick = () => {
    const action = markPaidBtn.dataset.action;
    const ownerFilter = filterOwner.value;
    const monthFilter = filterMonth.value;
    const isGlobal = currentSourceId === "All";

    // Group transactions by sourceId for bulk update
    const sourceGroups = {};
    currentTransactions
        .filter(tx =>
            (ownerFilter === "All" || tx.owners === ownerFilter) &&
            (monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter))) &&
            (!isGlobal || selectedSources.has(tx.sourceId))
        )
        .forEach(tx => {
            if (!sourceGroups[tx.sourceId]) sourceGroups[tx.sourceId] = [];
            sourceGroups[tx.sourceId].push(tx.id);
        });

    const totalCount = Object.values(sourceGroups).reduce((acc, ids) => acc + ids.length, 0);

    showNotification(`Mark ${totalCount} transactions as ${action === "paid" ? "Paid" : "Unpaid"}?`, true, async () => {
        await Promise.all(Object.entries(sourceGroups).map(([sid, ids]) =>
            bulkUpdateTransactionStatus(sid, ids, action)
        ));
        if (currentSourceId === "All") await fetchAndRenderGlobalTransactions(false);
    });
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
