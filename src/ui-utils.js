export const CATEGORIES = [
    "Dining",
    "Entertainment",
    "Fuel",
    "Grocery",
    "LIC/OICL",
    "Medicine",
    "Pets",
    "Rent",
    "Shopping",
    "Travel",
    "Utility Bills",
    "Other"];

/**
 * Shared notification helper using the alert modal
 */
export function setupNotification(alertModal, alertMessage, alertOkBtn, alertCancelBtn) {
    return (message, isConfirmation = false, onConfirmCallback = null) => {
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
    };
}

/**
 * Initialize common modals
 */
export function initCommonModals(modalIds) {
    const modals = {};
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            modals[id] = new bootstrap.Modal(el);
        }
    });
    return modals;
}

/**
 * Setup Calculator and Multi-Adder logic
 */
export function setupUtilityButtons(calculator, multiAdder, amountInput, commentInput) {
    const openCalcBtn = document.getElementById('open-calc-btn');
    if (openCalcBtn && calculator) {
        openCalcBtn.onclick = () => {
            calculator.open(amountInput.value || 0, (result) => {
                amountInput.value = result;
            });
        };
    }

    const openMultiAdderBtn = document.getElementById('open-multi-adder-btn');
    if (openMultiAdderBtn && multiAdder) {
        openMultiAdderBtn.onclick = () => {
            multiAdder.open(({ totalAmount, comment }) => {
                if (amountInput) amountInput.value = totalAmount;
                if (commentInput) commentInput.value = comment;
            });
        };
    }
}

/**
 * Populate standard select elements
 * @param {HTMLElement} selectEl
 * @param {string[]} options
 * @param {string|null} placeholder
 * @param {string} placeholderValue
 * @param {boolean} isDisabled
 */
export function populateSelect(selectEl, options, placeholder = null, placeholderValue = "", isDisabled = true) {
    if (!selectEl) return;
    let html = placeholder ? `<option value="${placeholderValue}" ${isDisabled ? 'disabled selected' : ''}>${placeholder}</option>` : "";
    html += options.map(opt => `<option value="${opt}">${opt}</option>`).join("");
    selectEl.innerHTML = html;
}

/**
 * Inject shared modals into the page
 */
import * as templates from "./modal-templates.js";
export function injectSharedModals() {
    let container = document.getElementById('shared-modals-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'shared-modals-container';
        document.body.appendChild(container);
    }

    container.innerHTML =
        templates.EXPENSE_MODAL_HTML +
        templates.TX_EDIT_MODAL_HTML +
        templates.ALERT_MODAL_HTML +
        templates.MULTI_ADDER_MODAL_HTML +
        templates.CALC_MODAL_HTML +
        templates.TRANSACTIONS_LIST_MODAL_HTML;
}
