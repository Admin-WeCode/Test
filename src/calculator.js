export class Calculator {
    constructor() {
        this.display = document.getElementById('calc-display');
        this.modal = new bootstrap.Modal(document.getElementById('calc-modal'));
        this.currentExpression = '';
        this.callback = null;

        this.init();
    }

    init() {
        // Button clicks
        document.querySelectorAll('[data-calc]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-calc');
                this.handleAction(action);
            });
        });

        // Submit button
        document.getElementById('calc-submit').addEventListener('click', () => {
            this.submit();
        });
    }

    handleAction(action) {
        if (action === 'C') {
            this.currentExpression = '';
        } else if (action === 'DEL') {
            this.currentExpression = this.currentExpression.slice(0, -1);
        } else if (action === '=') {
            this.calculate();
        } else {
            // Prevent multiple operators in a row
            const lastChar = this.currentExpression.slice(-1);
            const operators = ['+', '-', '*', '/'];
            if (operators.includes(action) && operators.includes(lastChar)) {
                this.currentExpression = this.currentExpression.slice(0, -1) + action;
            } else {
                this.currentExpression += action;
            }
        }
        this.updateDisplay();
    }

    calculate() {
        try {
            if (!this.currentExpression) return;
            // Use Function instead of eval for a bit more safety
            // Note: In a production app, a proper math parser would be better
            const result = new Function('return ' + this.currentExpression)();
            this.currentExpression = result.toString();
        } catch (e) {
            this.currentExpression = 'Error';
            setTimeout(() => {
                this.currentExpression = '';
                this.updateDisplay();
            }, 1000);
        }
    }

    updateDisplay() {
        this.display.innerText = this.currentExpression || '0';
    }

    open(initialValue, callback) {
        this.currentExpression = initialValue.toString() === '0' ? '' : initialValue.toString();
        this.callback = callback;
        this.updateDisplay();
        this.modal.show();
    }

    submit() {
        this.calculate();
        if (this.currentExpression !== 'Error') {
            if (this.callback) this.callback(this.currentExpression);
            this.modal.hide();
        }
    }
}
