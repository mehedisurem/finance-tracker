// frontend/js/auth.js

class AuthManager {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegister.bind(this));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        try {
            // Validate inputs
            validation.validateForm({ email, password }, {
                email: [
                    (value) => validation.required(value, 'Email'),
                    (value) => validation.email(value)
                ],
                password: [
                    (value) => validation.required(value, 'Password')
                ]
            });

            // Show loading state
            utils.showLoading(submitBtn, 'Signing In...');

            // Make login request
            const response = await api.login({ email, password });
            
            // Store token and user data
            api.setToken(response.token);
            utils.storage.set('currentUser', response.user);
            
            // Show success message
            utils.showNotification('Login successful! Redirecting...', 'success', 2000);
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);

        } catch (error) {
            utils.handleError(error, 'Login failed. Please check your credentials.');
        } finally {
            utils.hideLoading(submitBtn, 'Sign In');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        try {
            // Validate inputs
            validation.validateForm({ firstName, lastName, email, password }, {
                firstName: [
                    (value) => validation.required(value, 'First name')
                ],
                lastName: [
                    (value) => validation.required(value, 'Last name')
                ],
                email: [
                    (value) => validation.required(value, 'Email'),
                    (value) => validation.email(value)
                ],
                password: [
                    (value) => validation.required(value, 'Password'),
                    (value) => validation.minLength(value, 6, 'Password')
                ]
            });

            // Show loading state
            utils.showLoading(submitBtn, 'Creating Account...');

            // Make register request
            const response = await api.register({
                firstName,
                lastName,
                email,
                password
            });
            
            // Store token and user data
            api.setToken(response.token);
            utils.storage.set('currentUser', response.user);
            
            // Show success message
            utils.showNotification('Account created successfully! Redirecting...', 'success', 2000);
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);

        } catch (error) {
            utils.handleError(error, 'Registration failed. Please try again.');
        } finally {
            utils.hideLoading(submitBtn, 'Create Account');
        }
    }

    handleLogout() {
        // Remove token and user data
        api.removeToken();
        utils.storage.remove('currentUser');
        
        // Show message and redirect
        utils.showNotification('You have been logged out', 'info', 2000);
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
    }

    // Check authentication status
    isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }

    // Get current user data
    getCurrentUser() {
        return utils.storage.get('currentUser');
    }

    // Verify token validity
    async verifyToken() {
        try {
            const response = await api.getCurrentUser();
            utils.storage.set('currentUser', response.user);
            return true;
        } catch (error) {
            this.handleLogout();
            return false;
        }
    }
}

// Form switching functions for auth page
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
    
    // Auto-focus first input
    const firstInput = document.querySelector('input[type="email"], input[type="text"]');
    if (firstInput) {
        firstInput.focus();
    }
});