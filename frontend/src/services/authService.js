import api from './api.js';


export const login = async (email, password) => {
    const response = await api.post('/auth/login/', {
        email,
        password
    });
    return response.data;
};

export const register = async (email, password, password2, firstName, lastName, username = null) => {
    const data = {
        email,
        password,
        password2,
        first_name: firstName,
        last_name: lastName
    };

    if (username) {
        data.username = username;
    }

    const response = await api.post('/auth/register/', data);
    return response.data;
};

export const logout = async () => {
    const response = await api.post('/auth/logout/');
    return response.data;
};

export const getCurrentUser = async () => {
    const response = await api.get('/auth/me/');
    return response.data;
};
