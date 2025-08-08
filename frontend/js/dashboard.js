// frontend/js/dashboard.js

class Dashboard {
    constructor() {
        this.transactions = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = {
            search: '',
            category: '',
            type: ''
        };
        this.currentUser = null;
        this.monthlyBudget = 5000;
        
        this.init();
    }

    async init() {
        try {
            // Verify authentication
            const authManager = new AuthManager();
            if (!authManager.isAuthenticated()) {
                window.location.href = '/index.html';
                return;
            }

            // Get current user
            await this.loadCurrentUser();
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Load initial data
            await this.loadTransactions();
            await this.loadMonthlySummary();
            
            // Set today's date as default
            document.getElementById('transactionDate').valueAsDate = new Date();
            
        } catch (error) {
            utils.handleError(error, 'Failed to initialize dashboard');
        }
    }

    async loadCurrentUser() {
        try {
            const response = await api.getCurrentUser();
            this.currentUser = response.user;
            this.monthlyBudget = response.user.monthlyBudget || 5000;
            
            // Update UI with user info
            document.getElementById('userName').textContent = 
                `${response.user.firstName} ${response.user.lastName}`;
                
        } catch (error) {
            console.error('Failed to load user:', error);
        }
    }

    initializeEventListeners() {
        // Transaction form
        document.getElementById('transactionForm').addEventListener('submit', 
            this.handleAddTransaction.bind(this));
        
        // Search and filters
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', 
            utils.debounce(this.handleSearch.bind(this), 300));
        
        document.getElementById('filterCategory').addEventListener('change', 
            this.handleFilterChange.bind(this));
        document.getElementById('filterType').addEventListener('change', 
            this.handleFilterChange.bind(this));
        
        // Pagination
        document.getElementById('prevPage').addEventListener('click', 
            () => this.changePage(this.currentPage - 1));
        document.getElementById('nextPage').addEventListener('click', 
            () => this.changePage(this.currentPage + 1));
        
        // Import file
        document.getElementById('importFile').addEventListener('change', 
            this.handleImportFile.bind(this));
        
        // Transaction type change
        document.getElementById('transactionType').addEventListener('change', 
            this.updateFormBasedOnType.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    updateFormBasedOnType() {
        const type = document.getElementById('transactionType').value;
        const categorySelect = document.getElementById('category');
        
        // Update categories based on type
        if (type === 'income') {
            this.updateCategoryOptions([
                'Salary', 'Freelance', 'Investment', 'Other'
            ]);
        } else {
            this.updateCategoryOptions([
                'Housing', 'Utilities', 'Food', 'Transport', 'Insurance', 
                'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Other'
            ]);
        }
    }

    updateCategoryOptions(categories) {
        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = '<option value="">Select category</option>';
        
        const icons = {
            'Housing': '🏠', 'Utilities': '⚡', 'Food': '🍔', 'Transport': '🚗',
            'Insurance': '🛡️', 'Healthcare': '🏥', 'Entertainment': '🎬', 
            'Shopping': '🛒', 'Education': '📚', 'Salary': '💼', 
            'Freelance': '💻', 'Investment': '📈', 'Other': '📋'
        };
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = `${icons[category] || '📋'} ${category}`;
            categorySelect.appendChild(option);
        });
    }

    async handleAddTransaction(e) {
        e.preventDefault();
        
        const formData = this.getTransactionFormData();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        try {
            // Validate form data
            this.validateTransactionForm(formData);
            
            // Show loading state
            utils.showLoading(submitBtn, 'Adding...');
            
            // Create transaction
            await api.createTransaction(formData);
            
            // Show success message
            utils.showNotification('Transaction added successfully!', 'success');
            
            // Reset form and reload data
            this.clearForm();
            await this.loadTransactions();
            await this.loadMonthlySummary();
            
        } catch (error) {
            utils.handleError(error, 'Failed to add transaction');
        } finally {
            utils.hideLoading(submitBtn, '➕ Add Transaction');
        }
    }

    getTransactionFormData() {
        return {
            type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('amount').value),
            description: document.getElementById('description').value.trim(),
            category: document.getElementById('category').value,
            paymentMethod: document.getElementById('paymentMethod').value,
            date: document.getElementById('transactionDate').value
        };
    }

    validateTransactionForm(formData) {
        validation.validateForm(formData, {
            type: [(value) => validation.required(value, 'Transaction type')],
            amount: [
                (value) => validation.required(value, 'Amount'),
                (value) => validation.number(value, 'Amount')
            ],
            description: [(value) => validation.required(value, 'Description')],
            category: [(value) => validation.required(value, 'Category')],
            paymentMethod: [(value) => validation.required(value, 'Payment method')],
            date: [(value) => validation.required(value, 'Date')]
        });
    }

    async loadTransactions() {
        try {
            const params = {
                page: this.currentPage,
                limit: 20,
                ...this.filters
            };
            
            // Remove empty filters
            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });
            
            const response = await api.getTransactions(params);
            this.transactions = response.transactions;
            this.totalPages = response.totalPages;
            
            this.renderTransactions();
            this.updatePagination();
            
        } catch (error) {
            utils.handleError(error, 'Failed to load transactions');
        }
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        
        if (this.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <h3>No transactions found</h3>
                    <p>Try adjusting your search criteria or add a new transaction</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-meta">
                        <span class="transaction-category" style="background-color: ${utils.getCategoryColor(transaction.category)}20; color: ${utils.getCategoryColor(transaction.category)}">
                            ${transaction.category}
                        </span>
                        <span>${transaction.paymentMethod}</span>
                        <span>${utils.formatDate(transaction.date)}</span>
                    </div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'}${utils.formatCurrency(transaction.amount)}
                </div>
                <div class="transaction-actions">
                    <button class="btn btn-sm btn-outline" onclick="dashboard.editTransaction('${transaction._id}')">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="dashboard.deleteTransaction('${transaction._id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    updatePagination() {
        const pagination = document.getElementById('pagination');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
        
        if (this.totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'block';
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= this.totalPages;
        pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }

    async changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        
        this.currentPage = page;
        await this.loadTransactions();
    }

    handleSearch(e) {
        this.filters.search = e.target.value.trim();
        this.currentPage = 1;
        this.loadTransactions();
    }

    handleFilterChange(e) {
        const filterType = e.target.id.replace('filter', '').toLowerCase();
        this.filters[filterType] = e.target.value;
        this.currentPage = 1;
        this.loadTransactions();
    }

    async loadMonthlySummary() {
        try {
            const { year, month } = utils.getCurrentMonth();
            const summary = await api.getMonthlySummary(year, month);
            
            this.renderSummaryCards(summary);
            this.renderMonthlyStats(summary);
            this.renderCategoryBreakdown(summary.categoryBreakdown);
            
        } catch (error) {
            console.error('Failed to load monthly summary:', error);
        }
    }

    renderSummaryCards(summary) {
        document.getElementById('totalIncome').textContent = 
            utils.formatCurrency(summary.totalIncome || 0);
        document.getElementById('totalExpenses').textContent = 
            utils.formatCurrency(summary.totalExpenses || 0);
        document.getElementById('netBalance').textContent = 
            utils.formatCurrency(summary.netBalance || 0);
        
        const budgetRemaining = this.monthlyBudget - (summary.totalExpenses || 0);
        document.getElementById('budgetRemaining').textContent = 
            utils.formatCurrency(budgetRemaining);
        
        // Update colors based on values
        const netBalanceEl = document.getElementById('netBalance');
        const budgetRemainingEl = document.getElementById('budgetRemaining');
        
        netBalanceEl.style.color = (summary.netBalance || 0) >= 0 ? 
            'var(--success-color)' : 'var(--danger-color)';
        budgetRemainingEl.style.color = budgetRemaining >= 0 ? 
            'var(--success-color)' : 'var(--danger-color)';
    }

    renderMonthlyStats(summary) {
        const expenses = summary.totalExpenses || 0;
        const income = summary.totalIncome || 0;
        const count = summary.transactionCount || 0;
        
        document.getElementById('transactionCount').textContent = count;
        document.getElementById('avgExpense').textContent = 
            utils.formatCurrency(count > 0 ? expenses / count : 0);
        
        // Calculate largest expense (would need individual transaction data)
        document.getElementById('largestExpense').textContent = '$0.00';
        
        // Daily average
        const daysInMonth = new Date().getDate();
        document.getElementById('dailyAverage').textContent = 
            utils.formatCurrency(expenses / daysInMonth);
        
        // Savings rate
        const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;
        document.getElementById('savingsRate').textContent = 
            `${Math.max(0, savingsRate).toFixed(1)}%`;
    }

    renderCategoryBreakdown(categoryBreakdown) {
        const container = document.getElementById('categoryBreakdown');
        
        if (!categoryBreakdown || Object.keys(categoryBreakdown).length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <p>No category data yet</p>
                </div>
            `;
            return;
        }

        const sortedCategories = Object.entries(categoryBreakdown)
            .sort(([,a], [,b]) => b.expenses - a.expenses)
            .slice(0, 5);

        container.innerHTML = sortedCategories.map(([category, data]) => `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-dot" style="background-color: ${utils.getCategoryColor(category)}"></div>
                    <span class="category-name">${category}</span>
                </div>
                <div class="category-amount">${utils.formatCurrency(data.expenses)}</div>
            </div>
        `).join('');
    }

    async editTransaction(id) {
        try {
            const transaction = this.transactions.find(t => t._id === id);
            if (!transaction) {
                utils.showNotification('Transaction not found', 'error');
                return;
            }

            // Populate edit form
            document.getElementById('editTransactionId').value = id;
            document.getElementById('editType').value = transaction.type;
            document.getElementById('editAmount').value = transaction.amount;
            document.getElementById('editDescription').value = transaction.description;
            document.getElementById('editCategory').value = transaction.category;
            document.getElementById('editPaymentMethod').value = transaction.paymentMethod;
            document.getElementById('editDate').value = utils.formatDateForInput(transaction.date);

            // Show modal
            document.getElementById('editModal').style.display = 'flex';

        } catch (error) {
            utils.handleError(error, 'Failed to load transaction for editing');
        }
    }

    async saveEditTransaction() {
        try {
            const id = document.getElementById('editTransactionId').value;
            const formData = {
                type: document.getElementById('editType').value,
                amount: parseFloat(document.getElementById('editAmount').value),
                description: document.getElementById('editDescription').value.trim(),
                category: document.getElementById('editCategory').value,
                paymentMethod: document.getElementById('editPaymentMethod').value,
                date: document.getElementById('editDate').value
            };

            // Validate form data
            this.validateTransactionForm(formData);

            // Update transaction
            await api.updateTransaction(id, formData);

            // Show success message
            utils.showNotification('Transaction updated successfully!', 'success');

            // Close modal and reload data
            this.closeEditModal();
            await this.loadTransactions();
            await this.loadMonthlySummary();

        } catch (error) {
            utils.handleError(error, 'Failed to update transaction');
        }
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    async deleteTransaction(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }

        try {
            await api.deleteTransaction(id);
            utils.showNotification('Transaction deleted successfully!', 'success');
            
            await this.loadTransactions();
            await this.loadMonthlySummary();

        } catch (error) {
            utils.handleError(error, 'Failed to delete transaction');
        }
    }

    clearForm() {
        document.getElementById('transactionForm').reset();
        document.getElementById('transactionDate').valueAsDate = new Date();
        document.getElementById('transactionType').dispatchEvent(new Event('change'));
    }

    async setBudget() {
        const newBudget = prompt('Enter your monthly budget:', this.monthlyBudget);
        if (newBudget && !isNaN(newBudget) && newBudget > 0) {
            try {
                await api.updateBudget(parseFloat(newBudget));
                this.monthlyBudget = parseFloat(newBudget);
                utils.showNotification('Budget updated successfully!', 'success');
                await this.loadMonthlySummary();
            } catch (error) {
                utils.handleError(error, 'Failed to update budget');
            }
        }
    }

    async exportTransactions() {
        try {
            const response = await api.getTransactions({ limit: 1000 });
            const data = {
                transactions: response.transactions,
                exportDate: new Date().toISOString(),
                user: this.currentUser
            };
            
            utils.exportJSON(data, `transactions-${new Date().toISOString().split('T')[0]}.json`);
            utils.showNotification('Transactions exported successfully!', 'success');

        } catch (error) {
            utils.handleError(error, 'Failed to export transactions');
        }
    }

    async exportAllData() {
        try {
            // Get all transactions
            const transactionsResponse = await api.getTransactions({ limit: 1000 });
            
            // Get monthly summaries for past 12 months
            const summaries = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                try {
                    const summary = await api.getMonthlySummary(date.getFullYear(), date.getMonth() + 1);
                    summaries.push({
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        ...summary
                    });
                } catch (error) {
                    // Skip months with no data
                }
            }

            const data = {
                user: this.currentUser,
                transactions: transactionsResponse.transactions,
                summaries: summaries,
                exportDate: new Date().toISOString(),
                monthlyBudget: this.monthlyBudget
            };
            
            utils.exportJSON(data, `finance-data-complete-${new Date().toISOString().split('T')[0]}.json`);
            utils.showNotification('Complete data exported successfully!', 'success');

        } catch (error) {
            utils.handleError(error, 'Failed to export complete data');
        }
    }

    async handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await utils.importJSON(file);
            
            if (!data.transactions || !Array.isArray(data.transactions)) {
                throw new Error('Invalid file format: transactions array not found');
            }

            if (!confirm(`This will import ${data.transactions.length} transactions. Continue?`)) {
                return;
            }

            let imported = 0;
            let errors = 0;

            // Import transactions one by one
            for (const transaction of data.transactions) {
                try {
                    // Remove _id and userId to avoid conflicts
                    const { _id, userId, ...transactionData } = transaction;
                    await api.createTransaction(transactionData);
                    imported++;
                } catch (error) {
                    errors++;
                    console.error('Failed to import transaction:', error);
                }
            }

            utils.showNotification(
                `Import completed! ${imported} transactions imported, ${errors} errors.`, 
                errors > 0 ? 'warning' : 'success'
            );

            // Reload data
            await this.loadTransactions();
            await this.loadMonthlySummary();

        } catch (error) {
            utils.handleError(error, 'Failed to import data');
        } finally {
            // Clear file input
            e.target.value = '';
        }
    }

    viewReports() {
        // This could open a reports modal or navigate to a reports page
        utils.showNotification('Reports feature coming soon!', 'info');
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + N: New transaction (focus on amount field)
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            document.getElementById('amount').focus();
        }

        // Escape: Close modals
        if (e.key === 'Escape') {
            this.closeEditModal();
        }

        // Ctrl/Cmd + E: Export transactions
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            this.exportTransactions();
        }
    }
}

// Global functions for onclick handlers
let dashboard;

function clearForm() {
    dashboard.clearForm();
}

function setBudget() {
    dashboard.setBudget();
}

function exportTransactions() {
    dashboard.exportTransactions();
}

function exportAllData() {
    dashboard.exportAllData();
}

function viewReports() {
    dashboard.viewReports();
}

function closeEditModal() {
    dashboard.closeEditModal();
}

function saveEditTransaction() {
    dashboard.saveEditTransaction();
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});

// Handle modal clicks (close when clicking outside)
document.addEventListener('click', (e) => {
    const modal = document.getElementById('editModal');
    if (e.target === modal) {
        closeEditModal();
    }
});