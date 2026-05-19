import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

function getCookie(name) {
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    const cookie = cookies.find((row) => row.startsWith(`${name}=`));

    if (!cookie) {
        return null;
    }

    return decodeURIComponent(cookie.split("=")[1]);
}

api.interceptors.request.use((config) => {
    const method = config.method?.toUpperCase();

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const csrfToken = getCookie("csrftoken");

        if (csrfToken) {
            config.headers["X-CSRFToken"] = csrfToken;
        }
    }

    return config;
});

let isRefreshing = false;

api.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                redirectToLogin();
                return Promise.reject(error);
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('/auth/refresh/');
                isRefreshing = false;
                return api(originalRequest);
            } catch {
                isRefreshing = false;
                redirectToLogin();
                return Promise.reject(error);
            }
        }

        // Log errors only in development
        if (import.meta.env.DEV) {
            if (error.response) {
                console.error(`API error ${error.response.status}:`, error.response.data);
            } else if (error.request) {
                console.error('No response from server — is the backend running?');
            } else {
                console.error('Request error:', error.message);
            }
        }

        return Promise.reject(error);
    }
);

function redirectToLogin() {
    const current = window.location.pathname;
    if (!current.includes('login') && !current.includes('register')) {
        window.location.href = '/src/pages/login.html';
    }
}

export default api;
