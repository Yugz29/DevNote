import { register } from '../services/authService.js';

const registerForm = document.getElementById('register-form');
const errorMessage = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    const firstName = document.getElementById('first-name').value.trim();
    const lastName = document.getElementById('last-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;

    if (!firstName || !lastName || !email || !password || !password2) {
        errorMessage.textContent = 'Please fill in all required fields';
        return;
    }

    if (password != password2) {
        errorMessage.textContent = 'Passwords do not match';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creationg account...';

    try {
        await register(email, password, password2, firstName, lastName, username);
        window.location.href = '/src/pages/dashboard.html';
    } catch (error) {
        const data = error.response?.data;

        const message =
            data?.email?.[0] ||
            data?.password?.[0] ||
            data?.username?.[0] ||
            data?.non_field_errors?.[0] ||
            'Registration failed. Please try again';
        errorMessage.textContent = message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
    }
});
