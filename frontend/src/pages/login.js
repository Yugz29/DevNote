import api from '../services/api.js';

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message')

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        errorMessage.textContent = "Please fill in all fields"
        return;
    }

    try {
        const response = await api.post('/auth/login/', { email, password });
        window.location.href = "/src/pages/dashboard.html";
    } catch (error) {
        const message = error.response?.data?.detail || 'Login failed';
        errorMessage.textContent = message;
    }
});
