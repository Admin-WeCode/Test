import { subscribeToItems, addTransaction } from "./firebase-service.js";

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

// Populate category dropdown
const CATEGORIES = ["Grocery", "Pets", "Fuel", "Dining", "LIC/OICL", "Travel", "Entertainment", "Utility Bills", "Rent", "Other"];
inputCategory.innerHTML = `<option value="" disabled selected>Select Category...</option>` +
    CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

// Modal Elements
const modal = document.getElementById("expense-modal");
const openModalBtn = document.getElementById("open-modal-btn");
const closeModalBtn = document.querySelector(".close-btn");

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
                        text: 'Source Distribution',
                        font: { size: 16, weight: 'bold' },
                        padding: { bottom: 10 }
                    }
                }
            }
        });
    }
}

// Event Listeners
openModalBtn.onclick = () => {
    modal.style.display = "block";
    if (!inputDate.value) inputDate.valueAsDate = new Date();
};
closeModalBtn.onclick = () => modal.style.display = "none";

window.onclick = (event) => {
    if (event.target == modal) modal.style.display = "none";
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
        modal.style.display = "none";
        document.getElementById("input-date").valueAsDate = new Date();
    } catch (error) {
        showNotification("Failed to add transaction.");
    }
};

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
