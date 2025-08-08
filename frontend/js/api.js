// frontend/js/api.js

class APIClient {
    constructor() {
        // Change this to your deployed Vercel backend URL
        this.baseURL = 'https://your-backend-name.vercel.app/api';
        this.token = localStorage.getItem('authToken');
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    // Remove authentication token
    removeToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    // Get authentication headers
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(options.requireAuth !== false),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            
            // If unauthorized, redirect to login
            if (error.message.includes('401') || error.message.includes('Token')) {
                this.removeToken();
                if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                    window.location.href = '/index.html';
                }
            }
            
            throw error;
        }
    }

    // Authentication methods
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
            requireAuth: false
        });
    }

    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
            requireAuth: false
        });
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    // Transaction methods
    async getTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
        return this.request(endpoint);
    }

    async createTransaction(transactionData) {
        return this.request('/transactions', {
            method: 'POST',
            body: JSON.stringify(transactionData)
        });
    }

    async updateTransaction(id, transactionData) {
        return this.request(`/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(transactionData)
        });
    }

    async deleteTransaction(id) {
        return this.request(`/transactions/${id}`, {
            method: 'DELETE'
        });
    }

    async getMonthlySummary(year, month) {
        return this.request(`/transactions/summary/${year}/${month}`);
    }

    // User methods
    async updateUserProfile(userData) {
        return this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async updateBudget(budget) {
        return this.request('/users/budget', {
            method: 'PUT',
            body: JSON.stringify({ monthlyBudget: budget })
        });
    }
}

// Create global API instance
const api = new APIClient();

// Utility functions
const utils = {
    // Format currency
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    // Format date
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    },

    // Format date for input
    formatDateForInput(date) {
        return new Date(date).toISOString().split('T')[0];
    },

    // Get current month/year
    getCurrentMonth() {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1
        };
    },

    // Validate email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Debounce function for search
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Show loading state
    showLoading(element, text = 'Loading...') {
        if (element) {
            element.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>${text}</span>
                </div>
            `;
            element.disabled = true;
        }
    },

    // Hide loading state
    hideLoading(element, originalText = '') {
        if (element) {
            element.innerHTML = originalText;
            element.disabled = false;
        }
    },

    // Show notification
    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="modal-close">&times;</button>
        `;
        
        // Insert at the top of the page
        const container = document.body.firstElementChild;
        container.insertBefore(notification, container.firstChild);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    },

    // Handle API errors
    handleError(error, fallbackMessage = 'An error occurred') {
        const message = error.message || fallbackMessage;
        this.showNotification(message, 'error');
        console.error('Error:', error);
    },

    // Get category color
    getCategoryColor(category) {
        const colors = {
            'Housing': '#ef4444',
            'Utilities': '#f59e0b', 
            'Food': '#10b981',
            'Transport': '#3b82f6',
            'Insurance': '#8b5cf6',
            'Healthcare': '#f97316',
            'Entertainment': '#ec4899',
            'Shopping': '#06b6d4',
            'Education': '#84cc16',
            'Salary': '#10b981',
            'Freelance': '#059669',
            'Investment': '#0d9488',
            'Other': '#64748b'
        };
        return colors[category] || '#64748b';
    },

    // Export data as JSON
    exportJSON(data, filename = 'finance-data.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Import JSON data
    async importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('Invalid JSON file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    // Storage helpers
    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Error reading from storage:', error);
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('Error writing to storage:', error);
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error('Error removing from storage:', error);
            }
        }
    }
};

// Form validation helpers
const validation = {
    required(value, fieldName) {
        if (!value || (typeof value === 'string' && !value.trim())) {
            throw new Error(`${fieldName} is required`);
        }
        return true;
    },

    email(value) {
        if (!utils.isValidEmail(value)) {
            throw new Error('Please enter a valid email address');
        }
        return true;
    },

    minLength(value, min, fieldName) {
        if (value.length < min) {
            throw new Error(`${fieldName} must be at least ${min} characters long`);
        }
        return true;
    },

    number(value, fieldName) {
        if (isNaN(value) || value <= 0) {
            throw new Error(`${fieldName} must be a valid positive number`);
        }
        return true;
    },

    validateForm(formData, rules) {
        const errors = {};
        
        for (const [field, validators] of Object.entries(rules)) {
            const value = formData[field];
            
            try {
                for (const validator of validators) {
                    validator(value, field);
                }
            } catch (error) {
                errors[field] = error.message;
            }
        }
        
        if (Object.keys(errors).length > 0) {
            throw new Error(Object.values(errors)[0]);
        }
        
        return true;
    }
};

// Check if user is authenticated on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const isAuthPage = window.location.pathname.includes('index.html') || 
                       window.location.pathname === '/';
    
    if (!token && !isAuthPage) {
        // Not authenticated and not on auth page - redirect to login
        window.location.href = '/index.html';
    } else if (token && isAuthPage) {
        // Authenticated and on auth page - redirect to dashboard
        window.location.href = '/dashboard.html';
    }
});/ *   U p d a t e d   0 8 / 0 9 / 2 0 2 5   0 1 : 0 5 : 1 1   * /  
 