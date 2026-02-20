export class MultiAdder {
    constructor() {
        this.container = document.getElementById('multi-adder-container');
        this.totalDisplay = document.getElementById('multi-adder-total-val');
        this.modal = new bootstrap.Modal(document.getElementById('multi-adder-modal'));
        this.callback = null;
        this.rows = [];

        this.init();
    }

    init() {
        document.getElementById('add-item-row-btn').addEventListener('click', () => {
            this.addRow();
        });

        document.getElementById('multi-adder-submit').addEventListener('click', () => {
            this.submit();
        });
    }

    addRow(amount = '', detail = '') {
        const rowId = Date.now() + Math.random();
        const rowDiv = document.createElement('div');
        rowDiv.className = 'multi-adder-row animate__animated animate__fadeIn';
        rowDiv.dataset.id = rowId;

        rowDiv.innerHTML = `
            <div class="row g-2 align-items-center">
                <div class="col-4">
                    <div class="form-floating">
                        <input type="number" class="form-control item-amount" placeholder="Amount" value="${amount}" step="0.01">
                        <label>Amount</label>
                    </div>
                </div>
                <div class="col-7">
                    <div class="form-floating">
                        <input type="text" class="form-control item-detail" placeholder="Detail" value="${detail}">
                        <label>Detail</label>
                    </div>
                </div>
                <div class="col-1 text-end">
                    <button type="button" class="btn btn-link text-danger p-0 delete-row-btn">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;

        this.container.appendChild(rowDiv);

        // Add event listeners for total calculation
        rowDiv.querySelector('.item-amount').addEventListener('input', () => this.updateTotal());
        rowDiv.querySelector('.delete-row-btn').addEventListener('click', () => {
            rowDiv.remove();
            this.updateTotal();
        });

        this.updateTotal();
    }

    updateTotal() {
        let total = 0;
        const amounts = this.container.querySelectorAll('.item-amount');
        amounts.forEach(input => {
            total += Number(input.value) || 0;
        });
        this.totalDisplay.innerText = total.toLocaleString();
    }

    open(callback) {
        this.callback = callback;
        this.container.innerHTML = '';
        this.addRow(); // Start with one empty row
        this.updateTotal();
        this.modal.show();
    }

    submit() {
        const rows = Array.from(this.container.querySelectorAll('.multi-adder-row'));
        const items = rows.map(row => {
            return {
                amount: Number(row.querySelector('.item-amount').value) || 0,
                detail: row.querySelector('.item-detail').value.trim()
            };
        }).filter(item => item.amount > 0 || item.detail !== '');

        if (items.length === 0) {
            this.modal.hide();
            return;
        }

        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
        const comment = items.map(item => `${item.detail}: ${item.amount}`).join(', ');

        if (this.callback) {
            this.callback({
                totalAmount,
                comment
            });
        }
        this.modal.hide();
    }
}
