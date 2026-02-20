export const EXPENSE_MODAL_HTML = `
<div class="modal fade" id="expense-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg">
            <div class="modal-header border-0 pb-0 px-4 pt-4">
                <h5 class="modal-title fw-bold">Add Transaction</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="add-form">
                    <div class="form-floating mb-3">
                        <select class="form-select" id="input-name" required></select>
                        <label>Source (Document)</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input type="date" class="form-control" id="input-date" required>
                        <label>Date</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input type="text" class="form-control" id="input-details" placeholder="Details" required>
                        <label>Details</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select class="form-select" id="input-category" required></select>
                        <label>Category</label>
                    </div>
                    <div class="form-floating mb-3 amount-input-group">
                        <input type="number" class="form-control" id="input-amount" step="0.01" required>
                        <label>Amount (₹)</label>
                        <button type="button" class="btn btn-calc" id="open-calc-btn">
                            <span class="material-icons">calculate</span>
                        </button>
                        <button type="button" class="btn btn-add-multi" id="open-multi-adder-btn">
                            <span class="material-icons">add_circle</span>
                        </button>
                    </div>
                    <div class="form-floating mb-3">
                        <textarea class="form-control" id="input-comment" style="height: 100px" placeholder="Comment"></textarea>
                        <label>Comment (Optional)</label>
                    </div>
                    <div class="mb-4">
                        <label class="form-label d-block text-muted small fw-bold mb-2">OWNER</label>
                        <div class="btn-group w-100" role="group">
                            <input type="radio" class="btn-check" name="owner" id="owner-home" value="Home" checked>
                            <label class="btn btn-outline-primary" for="owner-home">Home</label>
                            <input type="radio" class="btn-check" name="owner" id="owner-ujjwal" value="Ujjwal">
                            <label class="btn btn-outline-primary" for="owner-ujjwal">Ujjwal</label>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 py-3 mt-2 shadow">
                        <span class="material-icons align-middle me-1">save</span> Add Transaction
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>`;

export const TX_EDIT_MODAL_HTML = `
<div class="modal fade" id="tx-edit-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg">
            <div class="modal-header border-0 pb-0 px-4 pt-4">
                <h5 class="modal-title fw-bold">Edit Transaction</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <form id="tx-edit-form">
                    <div class="form-floating mb-3">
                        <input type="date" class="form-control" id="edit-tx-date" required>
                        <label>Date</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="edit-tx-source" class="form-select" required></select>
                        <label>Source</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="edit-tx-category" class="form-select" required></select>
                        <label>Category</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input type="number" class="form-control" id="edit-tx-amount" step="0.01" required>
                        <label>Amount (₹)</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="edit-tx-owner" class="form-select" required>
                            <option value="Home">Home</option>
                            <option value="Ujjwal">Ujjwal</option>
                        </select>
                        <label>Owner</label>
                    </div>
                    <div class="form-floating mb-3">
                        <textarea id="edit-tx-details" class="form-control" style="height: 80px" required placeholder="Details"></textarea>
                        <label>Details</label>
                    </div>
                    <div class="form-floating mb-4">
                        <textarea id="edit-tx-comment" class="form-control" style="height: 80px" placeholder="Comment"></textarea>
                        <label>Comment</label>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-primary flex-grow-1 py-3 shadow">
                            <span class="material-icons align-middle me-1">save</span> Save Changes
                        </button>
                        <button type="button" id="delete-tx-btn" class="btn btn-outline-danger px-4">
                            <span class="material-icons align-middle">delete</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>`;

export const ALERT_MODAL_HTML = `
<div class="modal fade" id="alert-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow-lg rounded-4 text-center p-3">
            <div class="modal-body p-4">
                <span class="material-icons text-secondary mb-3" style="font-size: 3rem;">help_outline</span>
                <p id="alert-message" class="fs-5 fw-medium mb-4"></p>
                <div class="d-flex gap-2 justify-content-center">
                    <button id="alert-ok-btn" class="btn btn-primary px-4 rounded-pill shadow-sm">OK</button>
                    <button id="alert-cancel-btn" class="btn btn-outline-secondary px-4 rounded-pill" style="display: none;">Cancel</button>
                </div>
            </div>
        </div>
    </div>
</div>`;

export const MULTI_ADDER_MODAL_HTML = `
<div class="modal fade" id="multi-adder-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header border-0 px-4 pt-4">
                <h5 class="modal-title fw-bold">Multi-Item Adder</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body px-4">
                <div id="multi-adder-container"></div>
                <button type="button" class="btn btn-outline-primary w-100 mb-3" id="add-item-row-btn">
                    <span class="material-icons align-middle me-1">add</span> Add Item
                </button>
                <div class="multi-adder-total">
                    Total: ₹<span id="multi-adder-total-val">0</span>
                </div>
            </div>
            <div class="modal-footer border-0 px-4 pb-4">
                <button type="button" class="btn btn-light w-100 mb-2" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary w-100" id="multi-adder-submit">Submit breakdown</button>
            </div>
        </div>
    </div>
</div>`;

export const CALC_MODAL_HTML = `
<div class="modal fade" id="calc-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
            <div class="modal-header border-0 pb-0 px-4 pt-4">
                <h5 class="modal-title fw-bold">Calculator</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <div class="calc-display" id="calc-display">0</div>
                <div class="calc-grid">
                    <button type="button" class="calc-btn calc-btn-clear" data-calc="C">C</button>
                    <button type="button" class="calc-btn calc-btn-operator" data-calc="DEL">⌫</button>
                    <button type="button" class="calc-btn calc-btn-operator" data-calc="/">÷</button>
                    <button type="button" class="calc-btn calc-btn-operator" data-calc="*">×</button>
                    <button type="button" class="calc-btn" data-calc="7">7</button>
                    <button type="button" class="calc-btn" data-calc="8">8</button>
                    <button type="button" class="calc-btn" data-calc="9">9</button>
                    <button type="button" class="calc-btn calc-btn-operator" data-calc="-">−</button>
                    <button type="button" class="calc-btn" data-calc="4">4</button>
                    <button type="button" class="calc-btn" data-calc="5">5</button>
                    <button type="button" class="calc-btn" data-calc="6">6</button>
                    <button type="button" class="calc-btn calc-btn-operator" data-calc="+">+</button>
                    <button type="button" class="calc-btn" data-calc="1">1</button>
                    <button type="button" class="calc-btn" data-calc="2">2</button>
                    <button type="button" class="calc-btn" data-calc="3">3</button>
                    <button type="button" class="calc-btn calc-btn-operator" data-calc="=">=</button>
                    <button type="button" class="calc-btn" data-calc="0">0</button>
                    <button type="button" class="calc-btn" data-calc=".">.</button>
                    <button type="button" class="calc-btn calc-btn-submit" id="calc-submit">Submit</button>
                </div>
            </div>
        </div>
    </div>
</div>`;

export const TRANSACTIONS_LIST_MODAL_HTML = `
<div class="modal fade" id="transactions-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header border-0 pb-0 shadow-sm px-4 pt-4 d-flex align-items-center">
                <h3 class="modal-title fw-bold mb-0" id="transactions-title">Transactions</h3>
                <button id="modal-add-btn" class="btn btn-primary btn-sm ms-3 d-flex align-items-center shadow-sm">
                    <span class="material-icons fs-5 me-1">add</span> Add
                </button>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
                <div class="row g-2 mb-4 filters-row align-items-center" style="position: relative; z-index: 1030;">
                    <div class="col-md-2">
                        <select id="filter-owner" class="form-select shadow-sm">
                            <option value="All">All Owners</option>
                            <option value="Home">Home</option>
                            <option value="Ujjwal">Ujjwal</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select id="filter-month" class="form-select shadow-sm">
                            <option value="All">All Months</option>
                        </select>
                    </div>
                    <div id="multi-source-filter" class="col-md-4" style="display:none">
                        <!-- Multi-select Source Filter injected here -->
                    </div>
                    <div class="col d-flex">
                        <button id="mark-paid-btn" class="btn btn-success ms-auto d-flex align-items-center">
                            <span class="material-icons me-1">check_circle</span> Mark All
                        </button>
                    </div>
                </div>
                <div class="table-responsive" style="max-height: 60vh; overflow-y: auto;">
                    <table class="table table-hover align-middle">
                        <thead class="sticky-top bg-white shadow-sm">
                            <tr>
                                <th>Date</th>
                                <th class="col-source" style="display:none">Source</th>
                                <th>Details</th>
                                <th>Amount</th>
                                <th>Owner</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="transactions-list"></tbody>
                    </table>
                </div>
            </div>
            <div id="modal-total-footer" class="modal-footer border-0 bg-light py-3 px-4 shadow-sm" style="display:none">
                <div class="w-100 d-flex justify-content-between align-items-center">
                    <div>
                        <span class="text-muted fw-bold text-uppercase small me-2">Grand Total:</span>
                        <span id="grand-total-val" class="fw-bold fs-4 text-primary">₹0</span>
                    </div>
                    <div>
                        <span class="text-muted fw-bold text-uppercase small me-2">Paid:</span>
                        <span id="paid-total-val" class="fw-bold fs-4 text-success">₹0</span>
                    </div>
                    <div>
                        <span class="text-muted fw-bold text-uppercase small me-2">Outstanding:</span>
                        <span id="outstanding-total-val" class="fw-bold fs-4 text-danger">₹0</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;
