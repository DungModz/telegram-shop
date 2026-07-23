const API = {
    // 🔥 Đã cập nhật URL backend của bạn
    baseUrl: 'https://shopddung.onrender.com/api',

    async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Request failed');
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // ===== AUTH =====
    async auth(initData) {
        return this.request('/auth', 'POST', { initData });
    },

    // ===== PRODUCTS =====
    async getProducts() {
        return this.request('/products');
    },

    async getProduct(productId) {
        return this.request(`/product/${productId}`);
    },

    // ===== USER =====
    async getUser(userId) {
        return this.request(`/user/${userId}`);
    },

    // ===== RECHARGE =====
    async recharge(userId, amount) {
        return this.request('/recharge', 'POST', { userId, amount });
    },

    // ===== BUY =====
    async buy(userId, productId, quantity = 1) {
        return this.request('/buy', 'POST', { userId, productId, quantity });
    },

    // ===== ORDERS =====
    async getOrders(userId) {
        return this.request(`/orders/${userId}`);
    },

    // ===== TOP =====
    async getTop(filter) {
        return this.request(`/top/${filter}`);
    },

    // ===== ADMIN =====
    async addProduct(adminId, productData) {
        return this.request('/admin/add-product', 'POST', { adminId, ...productData });
    },

    async setUserRole(adminId, targetId, role, commissionRate = 30) {
        return this.request('/admin/set-role', 'POST', { adminId, targetId, role, commission_rate: commissionRate });
    }
};
