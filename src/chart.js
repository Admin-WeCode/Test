import { subscribeToItems, fetchAllTransactions } from "./firebase-service.js";

const filterSource = document.getElementById("chart-filter-source");
const filterMonth = document.getElementById("chart-filter-month");
const filterOwner = document.getElementById("chart-filter-owner");
const noDataMsg = document.getElementById("no-data-msg");
const summaryTbody = document.getElementById("summary-tbody");
const categoryCheckboxes = document.getElementById("category-checkboxes");

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
let allCategories = []; // all categories seen in data

// ── Bootstrap ────────────────────────────────────────────────────────────────
subscribeToItems(async (items) => {
    sourceIds = items.map(i => i.id);

    // Populate Source filter
    filterSource.innerHTML = `<option value="All">All Sources</option>` +
        sourceIds.map(id => `<option value="${id}">${id}</option>`).join("");

    // Fetch all transactions once
    allTransactions = await fetchAllTransactions(sourceIds);

    // Populate Month filter from data
    const months = [...new Set(
        allTransactions.filter(tx => tx.date).map(tx => tx.date.substring(0, 7))
    )].sort().reverse();

    filterMonth.innerHTML = `<option value="All">All Months</option>` +
        months.map(m => `<option value="${m}">${m}</option>`).join("");

    // Build category list from data (preserving insertion order)
    allCategories = [...new Set(
        allTransactions.map(tx => tx.category || "Uncategorised")
    )].sort();

    buildCategoryCheckboxes();

    noDataMsg.style.display = "none";
    renderChart();
});

// ── Category Checkboxes ───────────────────────────────────────────────────────
function buildCategoryCheckboxes() {
    categoryCheckboxes.innerHTML = allCategories.map(cat => {
        const color = getColor(cat);
        return `<label class="cat-checkbox-item">
            <input type="checkbox" class="cat-cb" value="${cat}" checked>
            <span class="color-dot" style="background:${color}; width:10px; height:10px; border-radius:50%; display:inline-block; flex-shrink:0;"></span>
            ${cat}
        </label>`;
    }).join("");

    // Listen for changes
    categoryCheckboxes.querySelectorAll(".cat-cb").forEach(cb =>
        cb.addEventListener("change", renderChart)
    );
}

function getSelectedCategories() {
    return [...categoryCheckboxes.querySelectorAll(".cat-cb:checked")].map(cb => cb.value);
}



// ── Dropdown Filters ──────────────────────────────────────────────────────────
[filterSource, filterMonth, filterOwner].forEach(el =>
    el.addEventListener("change", renderChart)
);

// ── Modal Logic ──────────────────────────────────────────────────────────────
function showTransactionsModal(category) {
    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;

    const filtered = allTransactions.filter(tx => {
        const cat = tx.category || "Uncategorised";
        const matchSrc = src === "All" || tx.sourceId === src;
        const matchMonth = month === "All" || (tx.date && tx.date.startsWith(month));
        const matchOwner = owner === "All" || tx.owners === owner;
        const matchCat = cat === category;
        return matchSrc && matchMonth && matchOwner && matchCat;
    });

    modalTitle.textContent = `Transactions: ${category}`;
    modalTbody.innerHTML = filtered.map(tx => `
        <tr>
            <td>${tx.date}</td>
            <td>${tx.sourceId}</td>
            <td>${tx.details}</td>
            <td>₹${Number(tx.amount).toLocaleString()}</td>
            <td>${tx.owners || ""}</td>
        </tr>
    `).join("");

    if (filtered.length === 0) {
        modalTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">No transactions found.</td></tr>';
    }

    modal.style.display = "block";
}

closeBtn.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

// ── Render ────────────────────────────────────────────────────────────────────
function renderChart() {
    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;
    const selected = new Set(getSelectedCategories());

    const filtered = allTransactions.filter(tx => {
        const cat = tx.category || "Uncategorised";
        const matchSrc = src === "All" || tx.sourceId === src;
        const matchMonth = month === "All" || (tx.date && tx.date.startsWith(month));
        const matchOwner = owner === "All" || tx.owners === owner;
        const matchCat = selected.has(cat);
        return matchSrc && matchMonth && matchOwner && matchCat;
    });

    // Aggregate by category
    const totals = {};
    filtered.forEach(tx => {
        const cat = tx.category || "Uncategorised";
        totals[cat] = (totals[cat] || 0) + (Number(tx.amount) || 0);
    });

    const labels = Object.keys(totals);
    const actualData = Object.values(totals);
    const grand = actualData.reduce((a, b) => a + b, 0);
    const colors = labels.map(l => getColor(l));

    // Calculate visual data with a minimum weight (e.g. 3% of total) for visibility
    const minVisualValue = grand * 0.03;
    const visualData = actualData.map(val => Math.max(val, minVisualValue));

    const canvas = document.getElementById("category-chart");

    if (labels.length === 0) {
        noDataMsg.textContent = selected.size === 0
            ? "No categories selected."
            : "No data for selected filters.";
        noDataMsg.style.display = "flex";
        canvas.style.display = "none";
        summaryTbody.innerHTML = "";
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        return;
    }

    noDataMsg.style.display = "none";
    canvas.style.display = "block";

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: "pie",
        data: {
            labels,
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
                    const category = labels[index];
                    showTransactionsModal(category);
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const index = ctx.dataIndex;
                            const val = actualData[index];
                            const pct = grand > 0 ? ((val / grand) * 100).toFixed(1) : 0;
                            return ` ₹${val.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Summary table — sorted by amount desc
    const sorted = labels
        .map((l, i) => ({ label: l, value: actualData[i], color: colors[i] }))
        .sort((a, b) => b.value - a.value);

    summaryTbody.innerHTML = sorted.map(row => {
        const pct = grand > 0 ? ((row.value / grand) * 100).toFixed(1) : "0.0";
        return `<tr class="clickable-row" data-category="${row.label}">
            <td><span class="color-dot" style="background:${row.color}"></span>${row.label}</td>
            <td>₹${row.value.toLocaleString()}</td>
            <td>${pct}%</td>
        </tr>`;
    }).join("") + `<tr class="total-row">
        <td>Total</td>
        <td>₹${grand.toLocaleString()}</td>
        <td>100%</td>
    </tr>`;

    // Add click listeners to summary table rows
    summaryTbody.querySelectorAll(".clickable-row").forEach(tr => {
        tr.onclick = () => showTransactionsModal(tr.dataset.category);
    });
}
