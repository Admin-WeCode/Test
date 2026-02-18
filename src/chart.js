import { subscribeToItems, fetchAllTransactions } from "./firebase-service.js";

// DOM Selectors with safety checks
const filterSource = document.getElementById("chart-filter-source");
const filterMonth = document.getElementById("chart-filter-month");
const filterOwner = document.getElementById("chart-filter-owner");
const noDataMsg = document.getElementById("no-data-msg");
const summaryTbody = document.getElementById("summary-tbody");
const masterCb = document.getElementById("master-category-cb");
const modalTitle = document.getElementById("modal-title");
const modalTbody = document.getElementById("modal-tbody");

// Bootstrap Modal Instance
let detailsModal;

document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('tx-details-modal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        detailsModal = new bootstrap.Modal(modalEl);
    }
});

const PALETTE = [
    "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
    "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
    "#00bcd4", "#8bc34a", "#607d8b", "#ff5722"
];

const categoryColorMap = {};
let colorIndex = 0;
function getColor(cat) {
    if (!categoryColorMap[cat]) {
        categoryColorMap[cat] = PALETTE[colorIndex++ % PALETTE.length];
    }
    return categoryColorMap[cat];
}

let allTransactions = [];
let chartInstance = null;
let sourceIds = [];
let allCategories = [];
let selectedCategories = new Set();

// ── Bootstrap/Firestore ────────────────────────────────────────────────────────
subscribeToItems(async (items) => {
    try {
        sourceIds = items.map(i => i.id);

        if (filterSource) {
            filterSource.innerHTML = `<option value="All">All Sources</option>` +
                sourceIds.map(id => `<option value="${id}">${id}</option>`).join("");
        }

        allTransactions = await fetchAllTransactions(sourceIds);

        const months = [...new Set(
            allTransactions
                .filter(tx => tx.date && typeof tx.date === 'string')
                .map(tx => tx.date.substring(0, 7))
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
function showTransactionsModal(category) {
    if (!filterSource || !filterMonth || !filterOwner) return;

    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;

    const filtered = allTransactions.filter(tx => {
        const cat = tx.category || "Uncategorised";
        return (src === "All" || tx.sourceId === src) &&
            (month === "All" || (tx.date && tx.date.startsWith(month))) &&
            (owner === "All" || tx.owners === owner) &&
            (cat === category);
    });

    if (modalTitle) modalTitle.textContent = `Transactions: ${category}`;
    if (modalTbody) {
        modalTbody.innerHTML = filtered.map(tx => `
            <tr>
                <td>${tx.date}</td>
                <td class="fw-medium">${tx.sourceId}</td>
                <td>${tx.details}</td>
                <td class="text-end fw-bold">₹${Number(tx.amount).toLocaleString()}</td>
                <td><span class="badge bg-light text-dark border">${tx.owners || ""}</span></td>
            </tr>
        `).join("");

        if (filtered.length === 0) {
            modalTbody.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No transactions found.</td></tr>';
        }
    }

    if (detailsModal) detailsModal.show();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderChart() {
    if (!filterSource || !filterMonth || !filterOwner || !noDataMsg) return;

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
    const grandTable = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    const chartLabels = categoriesInView.filter(cat => selectedCategories.has(cat));
    const actualChartData = chartLabels.map(cat => categoryTotals[cat]);
    const totalSumData = actualChartData.reduce((a, b) => a + b, 0);
    const colors = chartLabels.map(l => getColor(l));

    const minVisualValue = totalSumData * 0.03;
    const visualData = actualChartData.map(val => Math.max(val, minVisualValue));

    const canvas = document.getElementById("category-chart");

    if (chartLabels.length === 0) {
        noDataMsg.textContent = selectedCategories.size === 0 ? "No categories selected." : "No data for filters.";
        noDataMsg.classList.remove("d-none");
        noDataMsg.classList.add("d-flex");
        if (canvas) {
            canvas.classList.add("d-none");
            canvas.classList.remove("d-block");
        }
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    } else {
        noDataMsg.classList.add("d-none");
        noDataMsg.classList.remove("d-flex");
        if (canvas) {
            canvas.classList.remove("d-none");
            canvas.classList.add("d-block");
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
    }

    if (summaryTbody) {
        summaryTbody.innerHTML = categoriesInView.map(cat => {
            const val = categoryTotals[cat];
            const pct = grandTable > 0 ? ((val / grandTable) * 100).toFixed(1) : "0.0";
            const isChecked = selectedCategories.has(cat);
            const color = getColor(cat);
            return `
                <tr class="${isChecked ? '' : 'deselected-row'}">
                    <td class="text-center">
                        <div class="form-check d-inline-block">
                            <input class="form-check-input cat-item-cb" type="checkbox" data-cat="${cat}" ${isChecked ? 'checked' : ''}>
                        </div>
                    </td>
                    <td class="cat-label-cell" data-cat="${cat}">
                        <span class="color-dot" style="background:${color};"></span>
                        ${cat}
                    </td>
                    <td class="text-end fw-medium text-dark">₹${val.toLocaleString()}</td>
                    <td class="text-end text-muted small">${pct}%</td>
                </tr>
            `;
        }).join("") + (categoriesInView.length > 0 ? `
            <tr class="table-light fw-bold text-dark border-top-2">
                <td></td>
                <td class="ps-4">Total Sum</td>
                <td class="text-end">₹${grandTable.toLocaleString()}</td>
                <td class="text-end">100%</td>
            </tr>
        ` : "");

        summaryTbody.querySelectorAll(".cat-item-cb").forEach(cb => {
            cb.onchange = (e) => {
                const cat = e.target.dataset.cat;
                if (e.target.checked) selectedCategories.add(cat);
                else selectedCategories.delete(cat);

                if (masterCb) {
                    masterCb.checked = Array.from(categoriesInView).every(c => selectedCategories.has(c));
                }
                renderChart();
            };
        });

        summaryTbody.querySelectorAll(".cat-label-cell").forEach(cell => {
            cell.onclick = () => showTransactionsModal(cell.dataset.cat);
        });
    }
}
