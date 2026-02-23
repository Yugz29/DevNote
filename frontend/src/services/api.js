import axios from 'axios';


const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

let isRefreshing = false;

api.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                if (!window.location.pathname.includes('login') &&
                    !window.location.pathname.includes('register')) {
                    window.location.href = '/src/pages/login.html';
                }
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('/auth/refresh/');
                isRefreshing = false;
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                if (!window.location.pathname.includes('login') && 
                !window.location.pathname.includes('register')) {
                window.location.href = '/src/pages/login.html';
            }
        }
        // Case 1: Server responded with an error (4xx, 5xx)
        if (error.response) {
            console.error('Server error:', error.response.data);
        }
        // Case 2: No response (backend down, network disconnected)
        else if (error.request) {
            console.error('Unable to contact the server');
            alert('Server is running ?');
        }
        // Case 3: Error in the code
        else {
            console.error('Error:', error.message);
        }
        
        throw error;
    }
});

export default api;
