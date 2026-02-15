import { login } from '../services/authService.js';

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        errorMessage.textContent = "Please fill in all fields"
        return;
    }

    submitBtn.disabled = true;
    submitBtn.testContent = 'Signing in';

    try {
        await login(email, password);
        window.location.href = "/src/pages/dashboard.html";
    } catch (error) {
        const message = error.response?.data?.non_field_errors?.[0]
            || error.response?.data?.detail
            || 'Invalied email or password';
        errorMessage.textContent = message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
    }
});
