import { subscribeToItems, fetchAllTransactions } from "./firebase-service.js";

const txListContainer = document.getElementById("transactions-list");
const filterMonth = document.getElementById("filter-month");
const totalAmountEl = document.getElementById("total-amount");

let ALL_SOURCE_IDS = [];
let currentTransactions = [];

async function init() {
    // Show loading state
    txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';

    // Fetch all source IDs first
    subscribeToItems(async (items) => {
        ALL_SOURCE_IDS = items.map(i => i.id);
        await refreshData();
    });
}

async function refreshData() {
    try {
        const transactions = await fetchAllTransactions(ALL_SOURCE_IDS);
        // Filter for owner === "Home"
        currentTransactions = transactions.filter(tx => tx.owners === "Home");
        // Sort by date desc
        currentTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        populateMonthFilter(currentTransactions);
        renderTransactions();
    } catch (err) {
        console.error("Error fetching transactions:", err);
        txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-danger">Failed to load transactions.</td></tr>';
    }
}

function populateMonthFilter(transactions) {
    const months = new Set();
    transactions.forEach(tx => tx.date && months.add(tx.date.substring(0, 7)));
    const sortedMonths = Array.from(months).sort().reverse();
    const currentVal = filterMonth.value;

    // Check if "All" is selected or if we should set the default to the current month
    const nowMonth = new Date().toISOString().substring(0, 7);

    filterMonth.innerHTML = '<option value="All">All Months</option>';
    sortedMonths.forEach(m => {
        const option = document.createElement("option");
        option.value = m;
        option.textContent = m;
        filterMonth.appendChild(option);
    });

    // Selection Priority Logic:
    if (currentVal && currentVal !== "All" && Array.from(filterMonth.options).some(o => o.value === currentVal)) {
        filterMonth.value = currentVal;
    } else if (Array.from(filterMonth.options).some(o => o.value === nowMonth)) {
        filterMonth.value = nowMonth;
    } else {
        filterMonth.value = "All";
    }
}

function renderTransactions() {
    const monthFilter = filterMonth.value;
    const filtered = currentTransactions.filter(tx =>
        monthFilter === "All" || (tx.date && tx.date.startsWith(monthFilter))
    );

    txListContainer.innerHTML = "";
    let total = 0;

    if (filtered.length === 0) {
        txListContainer.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No transactions found for this period.</td></tr>';
        totalAmountEl.innerText = "₹0";
        return;
    }

    filtered.forEach(tx => {
        const amt = Number(tx.amount) || 0;
        total += amt;
        const row = document.createElement("tr");
        row.className = "animate-fade-in";

        const statusIcon = tx.status === "paid" ? "check_circle" : "pending";
        const statusClass = tx.status === "paid" ? "text-success" : "text-warning";

        row.innerHTML = `
            <td class="py-3">${tx.date}</td>
            <td class="py-3"><span class="badge bg-light text-dark border fw-normal px-2 py-1">${tx.sourceId}</span></td>
            <td class="py-3">
                <div class="fw-medium">${tx.details}</div>
                ${tx.comment ? `<div class="small text-muted mt-1 opacity-75">${tx.comment}</div>` : ''}
            </td>
            <td class="py-3 fw-bold text-dark">₹${amt.toLocaleString()}</td>
            <td class="py-3 text-end">
                <span class="material-icons align-middle ${statusClass}" style="font-size: 1.25rem;" title="${tx.status}">${statusIcon}</span>
            </td>
        `;
        txListContainer.appendChild(row);
    });

    totalAmountEl.innerText = `₹${total.toLocaleString()}`;
}

filterMonth.onchange = renderTransactions;

init();
