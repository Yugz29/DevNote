import api from './api';

export const search = async (query, type = null) => {
    const params = { q: query };
    if (type) params.type = type;

    const response = await api.get('/search/', { params });
    return response.data;
};
