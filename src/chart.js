import { subscribeToItems, fetchAllTransactions } from "./firebase-service.js";

const filterSource = document.getElementById("chart-filter-source");
const filterMonth = document.getElementById("chart-filter-month");
const filterOwner = document.getElementById("chart-filter-owner");
const noDataMsg = document.getElementById("no-data-msg");
const summaryTbody = document.getElementById("summary-tbody");

const PALETTE = [
    "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
    "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
    "#00bcd4", "#8bc34a"
];

let allTransactions = [];
let chartInstance = null;
let sourceIds = [];

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
        allTransactions
            .filter(tx => tx.date)
            .map(tx => tx.date.substring(0, 7))
    )].sort().reverse();

    filterMonth.innerHTML = `<option value="All">All Months</option>` +
        months.map(m => `<option value="${m}">${m}</option>`).join("");

    noDataMsg.style.display = "none";
    renderChart();
});

// ── Filters ───────────────────────────────────────────────────────────────────
[filterSource, filterMonth, filterOwner].forEach(el =>
    el.addEventListener("change", renderChart)
);

// ── Render ────────────────────────────────────────────────────────────────────
function renderChart() {
    const src = filterSource.value;
    const month = filterMonth.value;
    const owner = filterOwner.value;

    const filtered = allTransactions.filter(tx => {
        const matchSrc = src === "All" || tx.sourceId === src;
        const matchMonth = month === "All" || (tx.date && tx.date.startsWith(month));
        const matchOwner = owner === "All" || tx.owners === owner;
        return matchSrc && matchMonth && matchOwner;
    });

    // Aggregate by category
    const totals = {};
    filtered.forEach(tx => {
        const cat = tx.category || "Uncategorised";
        totals[cat] = (totals[cat] || 0) + (Number(tx.amount) || 0);
    });

    const labels = Object.keys(totals);
    const data = Object.values(totals);
    const grand = data.reduce((a, b) => a + b, 0);
    const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

    const canvas = document.getElementById("category-chart");

    if (labels.length === 0) {
        noDataMsg.textContent = "No data for selected filters.";
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
                data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed;
                            const pct = grand > 0 ? ((val / grand) * 100).toFixed(1) : 0;
                            return ` ₹${val.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Summary table
    const sorted = labels
        .map((l, i) => ({ label: l, value: data[i], color: colors[i] }))
        .sort((a, b) => b.value - a.value);

    summaryTbody.innerHTML = sorted.map(row => {
        const pct = grand > 0 ? ((row.value / grand) * 100).toFixed(1) : "0.0";
        return `<tr>
            <td><span class="color-dot" style="background:${row.color}"></span>${row.label}</td>
            <td>₹${row.value.toLocaleString()}</td>
            <td>${pct}%</td>
        </tr>`;
    }).join("") + `<tr class="total-row">
        <td>Total</td>
        <td>₹${grand.toLocaleString()}</td>
        <td>100%</td>
    </tr>`;
}
