import { subscribeToItems, fetchAllTransactions, updateTransaction, deleteTransaction, moveTransaction, addTransaction } from "./firebase-service.js";

// DOM Selectors with safety checks
const filterSource = document.getElementById("chart-filter-source");
const filterMonth = document.getElementById("chart-filter-month");
const filterOwner = document.getElementById("chart-filter-owner");
const summaryTbody = document.getElementById("summary-tbody");
const masterCb = document.getElementById("master-category-cb");
const noDataMsg = document.getElementById("no-data-msg");

// Modal Selectors
const txDetailsModal = document.getElementById("tx-details-modal");
const txModalTitle = document.getElementById("details-title");
const txModalBody = document.getElementById("modal-tbody");

const txEditForm = document.getElementById("tx-edit-form");
const deleteTxBtn = document.getElementById("delete-tx-btn");

const editTxDate = document.getElementById("edit-tx-date");
const editTxSource = document.getElementById("edit-tx-source");
const editTxCategory = document.getElementById("edit-tx-category");
const editTxAmount = document.getElementById("edit-tx-amount");
const editTxOwner = document.getElementById("edit-tx-owner");
const editTxDetails = document.getElementById("edit-tx-details");
const editTxComment = document.getElementById("edit-tx-comment");

// Add Modal Selectors
const form = document.getElementById("add-form");
const inputName = document.getElementById("input-name");
const inputDate = document.getElementById("input-date");
const inputDetails = document.getElementById("input-details");
const inputAmount = document.getElementById("input-amount");
const inputComment = document.getElementById("input-comment");
const inputCategory = document.getElementById("input-category");

// Alert Modal Selectors
const alertMessage = document.getElementById("alert-message");
const alertOkBtn = document.getElementById("alert-ok-btn");
const alertCancelBtn = document.getElementById("alert-cancel-btn");

// State Management
let allTransactions = [];
let allCategories = [];
let selectedCategories = new Set();
let sourceIds = [];
let chartInstance = null;
let currentSourceId = null;
let editingTransactionId = null;
let currentTxStatus = "pending";
let currentCategory = ""; // For context-aware quick add

// Bootstrap Modal Instances
let detailsModal, editModal, alertModal, mainRecordModal;

document.addEventListener('DOMContentLoaded', () => {
    const detailsEl = document.getElementById('tx-details-modal');
    const editEl = document.getElementById('tx-edit-modal');
    const alertEl = document.getElementById('alert-modal');
    const addEl = document.getElementById('expense-modal');

    if (detailsEl) detailsModal = new bootstrap.Modal(detailsEl);
    if (editEl) editModal = new bootstrap.Modal(editEl);
    if (alertEl) alertModal = new bootstrap.Modal(alertEl);
    if (addEl) mainRecordModal = new bootstrap.Modal(addEl);
});

const CATEGORIES = ["Grocery", "Pets", "Fuel", "Dining", "LIC/OICL", "Travel", "Entertainment", "Utility Bills", "Rent", "Other"];

// Helper: Consistent category colors
const categoryColorMap = {};
function getColor(cat) {
    if (categoryColorMap[cat]) return categoryColorMap[cat];
    const palette = [
        "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
        "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
        "#34495e", "#7f8c8d"
    ];
    const idx = Object.keys(categoryColorMap).length % palette.length;
    categoryColorMap[cat] = palette[idx];
    return categoryColorMap[cat];
}

// Populate filters and fetch initial data
subscribeToItems(async (items) => {
    try {
        sourceIds = items.map(i => i.id);

        if (filterSource) {
            filterSource.innerHTML = `<option value="All">All Sources</option>` +
                sourceIds.map(id => `<option value="${id}">${id}</option>`).join("");
        }

        if (inputName) {
            inputName.innerHTML = `<option value="" disabled selected>Source...</option>` +
                sourceIds.map(id => `<option value="${id}">${id}</option>`).join("");
        }

        if (editTxSource) {
            editTxSource.innerHTML = sourceIds.map(id => `<option value="${id}">${id}</option>`).join("");
        }

        if (inputCategory) {
            inputCategory.innerHTML = `<option value="" disabled selected>Select Category...</option>` +
                CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
        }

        if (editTxCategory) {
            editTxCategory.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
        }

        allTransactions = await fetchAllTransactions(sourceIds);

        const months = [...new Set(
            allTransactions.filter(tx => tx.date).map(tx => tx.date.substring(0, 7))
        )].sort().reverse();

        if (filterMonth) {
            filterMonth.innerHTML = `<option value="All">All Months</option>` +
                months.map(m => `<option value="${m}">${m}</option>`).join("");
        }

        allCategories = [...new Set(
            allTransactions.map(tx => tx.category || "Uncategorised")
        )].sort();

        // Default: all categories selected
        selectedCategories = new Set(allCategories);
        if (masterCb) masterCb.checked = true;

        if (noDataMsg) {
            noDataMsg.classList.add("d-none");
            noDataMsg.classList.remove("d-flex");
        }
        renderChart();
    } catch (err) {
        console.error("Critical error in analytics subscription:", err);
        if (noDataMsg) {
            noDataMsg.innerHTML = `<div class="alert alert-danger mb-0">Failed to load data. Please refresh.</div>`;
            noDataMsg.classList.remove("d-none");
            noDataMsg.classList.add("d-flex");
        }
    }
});

// ── Event Listeners ──────────────────────────────────────────────────────────
[filterSource, filterMonth, filterOwner].forEach(el => {
    if (el) el.addEventListener("change", renderChart);
});

if (masterCb) {
    masterCb.onchange = () => {
        if (masterCb.checked) {
            selectedCategories = new Set(allCategories);
        } else {
            selectedCategories.clear();
        }
        renderChart();
    };
}

// ── Modal Logic ──────────────────────────────────────────────────────────────
window.showTransactionsModal = showTransactionsModal;

function showTransactionsModal(category) {
    currentCategory = category;
    if (!filterSource || !filterMonth || !filterOwner) return;

    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;

    const filtered = allTransactions.filter(tx => {
        const cat = tx.category || "Uncategorised";
        return (cat === category) &&
            (src === "All" || tx.sourceId === src) &&
            (month === "All" || (tx.date && tx.date.startsWith(month))) &&
            (owner === "All" || tx.owners === owner);
    });

    if (txModalTitle) txModalTitle.textContent = `Transactions: ${category}`;
    if (txModalBody) {
        txModalBody.innerHTML = filtered.map(tx => `
            <tr style="cursor: pointer" class="tx-row" data-id="${tx.id}" data-source="${tx.sourceId}">
                <td>${tx.date}</td>
                <td><span class="badge bg-light text-dark border">${tx.sourceId}</span></td>
                <td class="fw-medium">${tx.details}</td>
                <td class="text-end fw-bold">₹${Number(tx.amount).toLocaleString()}</td>
                <td><span class="badge bg-light text-dark border">${tx.owners || "Home"}</span></td>
            </tr>
        `).join("");

        document.querySelectorAll(".tx-row").forEach(row => {
            row.onclick = () => {
                const txId = row.dataset.id;
                const srcId = row.dataset.source;
                const tx = filtered.find(t => t.id === txId && t.sourceId === srcId);
                if (tx) openEditModal(tx);
            };
        });

        if (filtered.length === 0) {
            txModalBody.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No records matching filters.</td></tr>';
        }
    }
    if (detailsModal) detailsModal.show();
}

function openEditModal(tx) {
    editingTransactionId = tx.id;
    currentSourceId = tx.sourceId;
    currentTxStatus = tx.status || "pending";
    if (editTxDate) editTxDate.value = tx.date;
    if (editTxSource) editTxSource.value = tx.sourceId;
    if (editTxCategory) editTxCategory.value = tx.category || "Other";
    if (editTxAmount) editTxAmount.value = tx.amount;
    if (editTxOwner) editTxOwner.value = tx.owners || "Home";
    if (editTxDetails) editTxDetails.value = tx.details;
    if (editTxComment) editTxComment.value = tx.comment || "";
    if (editModal) editModal.show();
}

const modalAddBtn = document.getElementById("modal-add-btn");
if (modalAddBtn) {
    modalAddBtn.onclick = () => {
        if (inputCategory) inputCategory.value = currentCategory === "Uncategorised" ? "" : currentCategory;
        if (inputDate) inputDate.valueAsDate = new Date();
        if (mainRecordModal) mainRecordModal.show();
    };
}

const refreshData = async () => {
    allTransactions = await fetchAllTransactions(sourceIds);
    renderChart();
};

function showNotification(message, isConfirmation = false, onConfirmCallback = null) {
    if (!alertMessage || !alertModal) return;
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

// ── Core Logic ───────────────────────────────────────────────────────────────

function renderChart() {
    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;

    const tableFiltered = allTransactions.filter(tx => {
        const matchSrc = src === "All" || tx.sourceId === src;
        const matchMonth = month === "All" || (tx.date && tx.date.startsWith(month));
        const matchOwner = owner === "All" || tx.owners === owner;
        return matchSrc && matchMonth && matchOwner;
    });

    const categoryTotals = {};
    tableFiltered.forEach(tx => {
        const cat = tx.category || "Uncategorised";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
    });

    const categoriesInView = Object.keys(categoryTotals).sort();
    const chartLabels = categoriesInView.filter(cat => selectedCategories.has(cat));
    const actualChartData = chartLabels.map(cat => categoryTotals[cat]);
    const totalSumData = actualChartData.reduce((a, b) => a + b, 0);
    const colors = chartLabels.map(l => getColor(l));

    // Ensure small slices are visible/clickable
    const minVisualValue = totalSumData * 0.03;
    const visualData = actualChartData.map(val => Math.max(val, minVisualValue));

    const canvas = document.getElementById("category-chart");
    if (!canvas) return;

    if (chartLabels.length === 0) {
        if (noDataMsg) {
            noDataMsg.textContent = selectedCategories.size === 0 ? "No categories selected." : "No data for filters.";
            noDataMsg.classList.remove("d-none");
            noDataMsg.classList.add("d-flex");
        }
        canvas.classList.add("d-none");
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    } else {
        if (noDataMsg) {
            noDataMsg.classList.add("d-none");
            noDataMsg.classList.remove("d-flex");
        }
        canvas.classList.remove("d-none");
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(canvas, {
            type: "pie",
            data: {
                labels: chartLabels,
                datasets: [{
                    data: visualData,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: "#fff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        showTransactionsModal(chartLabels[index]);
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = actualChartData[ctx.dataIndex];
                                const pct = totalSumData > 0 ? ((val / totalSumData) * 100).toFixed(1) : 0;
                                return ` ₹${val.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderTable(categoryTotals, totalSumData);
}

function renderTable(categoryTotals, grandTotal) {
    if (!summaryTbody) return;
    summaryTbody.innerHTML = "";

    Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        const pct = grandTotal > 0 && selectedCategories.has(cat) ? ((amt / grandTotal) * 100).toFixed(1) : 0;
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        if (!selectedCategories.has(cat)) tr.classList.add("opacity-50", "text-muted");

        tr.innerHTML = `
            <td class="text-center align-middle" onclick="event.stopPropagation()">
                <div class="form-check d-inline-block">
                    <input class="form-check-input row-cb" type="checkbox" data-cat="${cat}" ${selectedCategories.has(cat) ? 'checked' : ''}>
                </div>
            </td>
            <td onclick="showTransactionsModal('${cat}')">
                <div class="d-flex align-items-center">
                    <span class="color-dot me-2" style="background-color: ${getColor(cat)}"></span>
                    ${cat}
                </div>
            </td>
            <td class="text-end fw-bold" onclick="showTransactionsModal('${cat}')">₹${amt.toLocaleString()}</td>
            <td class="text-end small text-muted" onclick="showTransactionsModal('${cat}')">${pct}%</td>
        `;
        summaryTbody.appendChild(tr);
    });

    document.querySelectorAll(".row-cb").forEach(cb => {
        cb.onchange = (e) => {
            const cat = e.target.dataset.cat;
            if (e.target.checked) selectedCategories.add(cat);
            else selectedCategories.delete(cat);

            // Sync master cb
            if (masterCb) {
                masterCb.checked = selectedCategories.size === allCategories.length;
            }
            renderChart();
        };
    });
}

// ── Form Handlers ────────────────────────────────────────────────────────────
if (form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const srcId = inputName.value;
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
            await addTransaction(srcId, transactionData);
            showNotification("Added successfully!");
            form.reset();
            if (mainRecordModal) mainRecordModal.hide();
            refreshData();
        } catch (error) {
            showNotification("Failed to add transaction.");
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
                if (editModal) editModal.hide();
                if (detailsModal) detailsModal.hide();
            } else {
                await updateTransaction(currentSourceId, editingTransactionId, updatedData);
                showNotification("Updated!");
                if (editModal) editModal.hide();
            }
            refreshData();
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
            if (editModal) editModal.hide();
            if (detailsModal) detailsModal.hide(); // Hide the list modal too as it might be stale
            refreshData();
        } catch (err) {
            showNotification("Failed to delete.");
        }
    });
}
