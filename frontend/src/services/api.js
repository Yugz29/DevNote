import axios from 'axios';


const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor to handle errors globally
api.interceptors.response.use(
    // If the request is successful (2xx), it is allowed to pass
    response => response,
    error => {
        // Case 1: The server responded with an error (4xx, 5xx)
        if (error.response) {
            const status = error.response.status;

            if (status === 401) {
                console.error('Session expired, redirecting...');
                window.location.href = '/index.html';
            }

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

        return Promise.reject(error);
    }
);

export default api;
