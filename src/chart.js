import { subscribeToItems, fetchAllTransactions } from "./firebase-service.js";

const filterSource = document.getElementById("chart-filter-source");
const filterMonth = document.getElementById("chart-filter-month");
const filterOwner = document.getElementById("chart-filter-owner");
const noDataMsg = document.getElementById("no-data-msg");
const summaryTbody = document.getElementById("summary-tbody");
const masterCb = document.getElementById("master-category-cb");

const modal = document.getElementById("tx-details-modal");
const closeBtn = document.getElementById("close-tx-modal");
const modalTitle = document.getElementById("modal-title");
const modalTbody = document.getElementById("modal-tbody");

const PALETTE = [
    "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
    "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
    "#00bcd4", "#8bc34a", "#607d8b", "#ff5722"
];

// Stable category → color mapping so colors don't shift when filtering
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
let selectedCategories = new Set(); // Using a Set for tracking selected categories manually

// ── Bootstrap ────────────────────────────────────────────────────────────────
subscribeToItems(async (items) => {
    sourceIds = items.map(i => i.id);

    filterSource.innerHTML = `<option value="All">All Sources</option>` +
        sourceIds.map(id => `<option value="${id}">${id}</option>`).join("");

    allTransactions = await fetchAllTransactions(sourceIds);

    const months = [...new Set(
        allTransactions.filter(tx => tx.date).map(tx => tx.date.substring(0, 7))
    )].sort().reverse();

    filterMonth.innerHTML = `<option value="All">All Months</option>` +
        months.map(m => `<option value="${m}">${m}</option>`).join("");

    allCategories = [...new Set(
        allTransactions.map(tx => tx.category || "Uncategorised")
    )].sort();

    // Default: all categories selected
    selectedCategories = new Set(allCategories);
    if (masterCb) masterCb.checked = true;

    noDataMsg.style.display = "none";
    renderChart();
});

// ── Dropdown Filters ──────────────────────────────────────────────────────────
[filterSource, filterMonth, filterOwner].forEach(el =>
    el.addEventListener("change", renderChart)
);

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

    modalTitle.textContent = `Transactions: ${category}`;
    modalTbody.innerHTML = filtered.map(tx => `
        <tr>
            <td style="padding:12px; border:1px solid #eee;">${tx.date}</td>
            <td style="padding:12px; border:1px solid #eee;">${tx.sourceId}</td>
            <td style="padding:12px; border:1px solid #eee;">${tx.details}</td>
            <td style="padding:12px; border:1px solid #eee;">₹${Number(tx.amount).toLocaleString()}</td>
            <td style="padding:12px; border:1px solid #eee;">${tx.owners || ""}</td>
        </tr>
    `).join("");

    if (filtered.length === 0) {
        modalTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">No transactions found.</td></tr>';
    }

    modal.style.display = "block";
}

closeBtn.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
    if (event.target == modal) modal.style.display = "none";
};

// ── Render ────────────────────────────────────────────────────────────────────
function renderChart() {
    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;

    // First, aggregate all data for the table regardless of current 'selectedCategories'
    // but honoring the dropdown filters (source, month, owner)
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

    // Filtered data specifically for the CHART based on category selection
    const chartLabels = categoriesInView.filter(cat => selectedCategories.has(cat));
    const actualChartData = chartLabels.map(cat => categoryTotals[cat]);
    const totalSumData = actualChartData.reduce((a, b) => a + b, 0);
    const colors = chartLabels.map(l => getColor(l));

    // Min-visual weight for visibility
    const minVisualValue = totalSumData * 0.03;
    const visualData = actualChartData.map(val => Math.max(val, minVisualValue));

    const canvas = document.getElementById("category-chart");

    if (chartLabels.length === 0) {
        noDataMsg.textContent = selectedCategories.size === 0 ? "No categories selected." : "No data for filters.";
        noDataMsg.style.display = "flex";
        canvas.style.display = "none";
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    } else {
        noDataMsg.style.display = "none";
        canvas.style.display = "block";
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

    // Render Summary Table
    summaryTbody.innerHTML = categoriesInView.map(cat => {
        const val = categoryTotals[cat];
        const pct = grandTable > 0 ? ((val / grandTable) * 100).toFixed(1) : "0.0";
        const isChecked = selectedCategories.has(cat);
        const color = getColor(cat);
        return `
            <tr class="clickable-row ${isChecked ? '' : 'deselected-row'}" style="opacity: ${isChecked ? '1' : '0.5'}; border-bottom: 1px solid #eee;">
                <td style="text-align: center; padding: 12px;"><input type="checkbox" class="cat-item-cb" data-cat="${cat}" ${isChecked ? 'checked' : ''}></td>
                <td class="cat-label-cell" data-cat="${cat}" style="padding: 12px; cursor: pointer;">
                    <span class="color-dot" style="background:${color}; width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
                    ${cat}
                </td>
                <td style="padding: 12px; text-align: right; font-weight: 500;">₹${val.toLocaleString()}</td>
                <td style="padding: 12px; text-align: right; color: #666;">${pct}%</td>
            </tr>
        `;
    }).join("") + (categoriesInView.length > 0 ? `
        <tr class="total-row" style="background: #f8f9fa; font-weight: bold;">
            <td></td>
            <td style="padding: 12px;">Total Sum</td>
            <td style="padding: 12px; text-align: right;">₹${grandTable.toLocaleString()}</td>
            <td style="padding: 12px; text-align: right;">100%</td>
        </tr>
    ` : "");

    // Attach Event Listeners to table elements
    summaryTbody.querySelectorAll(".cat-item-cb").forEach(cb => {
        cb.onchange = (e) => {
            const cat = e.target.dataset.cat;
            if (e.target.checked) selectedCategories.add(cat);
            else selectedCategories.delete(cat);

            // Sync master checkbox
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
