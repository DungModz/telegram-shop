const APP = {
    user: null,
    products: [],
    currentPage: 'buy',
    currentTopFilter: 'month'
};

function formatPrice(price) {
    if (!price) return '0đ';
    return price.toLocaleString('vi-VN') + 'đ';
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(el => {
        el.style.display = 'none';
    });
    
    const pageMap = {
        'buy': 'buyPage',
        'recharge': 'rechargePage',
        'top': 'topPage',
        'profile': 'profilePage',
        'admin': 'adminPage'
    };
    
    const target = document.getElementById(pageMap[page]);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.nav-btn').forEach((btn, index) => {
        btn.classList.remove('active');
        const pages = ['buy', 'recharge', 'top', 'profile', 'admin'];
        if (pages[index] === page) {
            btn.classList.add('active');
        }
    });
    
    APP.currentPage = page;
    
    if (page === 'top') loadTop(APP.currentTopFilter);
    if (page === 'profile') loadProfile();
    if (page === 'admin') loadAdminPanel();
}

async function initApp() {
    try {
        const user = TG.user;
        if (!user) {
            TG.showAlert('Vui lòng mở app từ Telegram!');
            return;
        }
        
        const authResult = await API.auth(TG.initData);
        APP.user = authResult.user;
        
        console.log('✅ User authenticated:', APP.user);
        
        // Show admin nav if user is admin
        if (APP.user?.role === 'admin') {
            document.getElementById('adminNavBtn').style.display = 'flex';
        }
        
        await loadProducts();
        await loadProfile();
        showPage('buy');
        handleReferral();
        
    } catch (error) {
        console.error('Init error:', error);
        TG.showAlert('Có lỗi xảy ra, vui lòng thử lại!');
    }
}

async function loadProducts() {
    try {
        const products = await API.getProducts();
        APP.products = products;
        renderProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productList').innerHTML = 
            '<div class="empty-state"><span class="empty-icon">❌</span>Không thể tải sản phẩm</div>';
    }
}

function renderProducts(products) {
    const container = document.getElementById('productList');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span>Chưa có sản phẩm</div>';
        return;
    }
    
    let html = '';
    products.forEach(p => {
        const price = APP.user?.role === 'admin' || APP.user?.role === 'reseller' 
            ? p.reseller_price || p.price 
            : p.price;
        
        html += `
            <div class="product-card" onclick="buyProduct('${p.id}')">
                <div class="product-top">
                    <h3>${p.name}</h3>
                    <span class="product-tag">${p.package || 'VIP'}</span>
                </div>
                <p>${p.description || 'Hỗ trợ lên đến iOS 27, dễ cài đặt và dễ sử dụng'}</p>
                <div class="product-bottom">
                    <div class="product-price">${formatPrice(price)}</div>
                    <div class="product-stock">
                        <span class="dot"></span>
                        Kho: ${p.stock || 999}
                    </div>
                </div>
                <button class="buy-btn" style="margin-top:10px;width:100%">MUA NGAY</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function buyProduct(productId) {
    if (!APP.user) {
        TG.showAlert('Vui lòng đăng nhập!');
        return;
    }
    
    const product = APP.products.find(p => p.id === productId);
    if (!product) {
        TG.showAlert('Sản phẩm không tồn tại!');
        return;
    }
    
    const price = APP.user?.role === 'admin' || APP.user?.role === 'reseller'
        ? product.reseller_price || product.price
        : product.price;
    
    const confirmed = await TG.showConfirm(
        `Bạn muốn mua:\n${product.name}\nGiá: ${formatPrice(price)}`
    );
    
    if (!confirmed) return;
    
    try {
        TG.haptic('heavy');
        const result = await API.buy(APP.user.id, productId, 1);
        
        if (!result.success) {
            TG.showAlert(result.error || 'Mua thất bại!');
            return;
        }
        
        const keys = result.keys.join('\n');
        await TG.showPopup({
            title: '🎉 MUA THÀNH CÔNG!',
            message: `Key của bạn:\n\n${keys}\n\n📌 Lưu lại ngay!`,
            buttons: [{ type: 'ok', text: 'Đã lưu' }]
        });
        
        await loadProfile();
        await loadProducts();
        
    } catch (error) {
        TG.showAlert('Có lỗi xảy ra, vui lòng thử lại!');
    }
}

async function recharge(amount) {
    if (!APP.user) {
        TG.showAlert('Vui lòng đăng nhập!');
        return;
    }
    
    const confirmed = await TG.showConfirm(
        `Nạp ${formatPrice(amount)} vào tài khoản?`
    );
    
    if (!confirmed) return;
    
    try {
        TG.haptic('heavy');
        const result = await API.recharge(APP.user.id, amount);
        
        if (!result.success) {
            TG.showAlert(result.error || 'Nạp thất bại!');
            return;
        }
        
        TG.showAlert(`✅ Nạp thành công ${formatPrice(amount)}!`);
        APP.user = result.user;
        await loadProfile();
        document.getElementById('rechargeResult').innerHTML = 
            `<div class="empty-state"><span class="empty-icon">✅</span>Nạp thành công ${formatPrice(amount)}</div>`;
        
    } catch (error) {
        TG.showAlert('Có lỗi xảy ra, vui lòng thử lại!');
    }
}

async function rechargeCustom() {
    const input = document.getElementById('customAmount');
    const amount = parseInt(input.value);
    
    if (!amount || amount < 1000) {
        TG.showAlert('Vui lòng nhập số tiền hợp lệ (tối thiểu 1.000đ)');
        return;
    }
    
    await recharge(amount);
    input.value = '';
}

async function loadTop(filter) {
    APP.currentTopFilter = filter || 'month';
    
    document.querySelectorAll('.filter-tab').forEach((tab, index) => {
        const filters = ['month', 'week', 'all'];
        tab.classList.toggle('active', filters[index] === APP.currentTopFilter);
    });
    
    const container = document.getElementById('topList');
    if (!container) return;
    
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>⏳ Đang tải...</p></div>`;
    
    try {
        const users = await API.getTop(APP.currentTopFilter);
        
        if (users.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span>Chưa có dữ liệu nạp tiền</div>';
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        let html = '';
        
        users.forEach((u, index) => {
            const rank = index + 1;
            const rankDisplay = rank <= 3 ? medals[index] : `#${rank}`;
            const rankClass = rank <= 3 ? `top-${rank}` : '';
            
            const displayName = u.first_name || u.username || 'Người dùng';
            const usernameDisplay = u.username ? `@${u.username}` : '';
            const amount = u.total_recharge || 0;
            
            html += `
                <div class="top-item ${rankClass}">
                    <div class="top-rank">${rankDisplay}</div>
                    <div class="top-info">
                        <div class="top-name">${displayName}</div>
                        ${usernameDisplay ? `<div class="top-username">${usernameDisplay}</div>` : ''}
                        <div class="top-id">ID: ${u.id}</div>
                    </div>
                    <div class="top-amount">${formatPrice(amount)}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">❌</span>Có lỗi xảy ra</div>';
    }
}

async function loadProfile() {
    if (!APP.user) return;
    
    try {
        const userData = await API.getUser(APP.user.id);
        APP.user = userData;
        
        const name = userData.first_name || userData.username || 'User';
        const avatar = name.charAt(0).toUpperCase();
        
        // Update all user headers
        document.querySelectorAll('#buyUsername, #profileUsername').forEach(el => {
            el.textContent = name;
        });
        document.querySelectorAll('#buyUserId, #profileUserId').forEach(el => {
            el.textContent = `ID: ${userData.id}`;
        });
        document.querySelectorAll('#buyAvatar, #profileAvatar').forEach(el => {
            el.textContent = avatar;
        });
        document.querySelectorAll('#buyBalance, #profileBalance').forEach(el => {
            el.textContent = userData.balance || 0;
        });
        document.querySelectorAll('#buyRole, #profileRole').forEach(el => {
            el.textContent = (userData.role || 'CUSTOMER').toUpperCase();
        });
        
        // Stats
        document.getElementById('totalBought').textContent = userData.total_bought || 0;
        document.getElementById('totalSpent').textContent = formatPrice(userData.total_spent || 0);
        document.getElementById('totalRecharge').textContent = formatPrice(userData.total_recharge || 0);
        
        // Referral
        const rate = userData.commission_rate || 10;
        document.getElementById('commissionRate').textContent = `${rate}%`;
        document.getElementById('commissionEarned').textContent = formatPrice(userData.commission_earned || 0);
        
        // 🔥 QUAN TRỌNG: Thay 'DungModzShop_bot' bằng username bot của bạn
        const botUsername = 'shopddung_bot';
        document.getElementById('refLink').value = `https://t.me/${botUsername}?start=${userData.id}`;
        
        await loadOrders(userData.id);
        
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadOrders(userId) {
    const container = document.getElementById('purchaseHistory');
    if (!container) return;
    
    try {
        const orders = await API.getOrders(userId);
        
        if (orders.length === 0) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>Chưa có SP nào.</div>`;
            return;
        }
        
        let html = '';
        orders.forEach(order => {
            html += `
                <div class="history-item">
                    <div>
                        <div class="product-name">${order.product_name || 'Sản phẩm'}</div>
                        <div class="product-detail">x${order.quantity || 1}</div>
                        <div class="product-date">${formatDate(order.created_at)}</div>
                    </div>
                    <div class="product-price">${formatPrice(order.total)}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">❌</span>Không thể tải lịch sử</div>';
    }
}

function copyRefLink() {
    const input = document.getElementById('refLink');
    if (!input) return;
    
    input.select();
    document.execCommand('copy');
    TG.showAlert('✅ Đã sao chép link giới thiệu!');
}

function handleReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    
    if (startParam && startParam !== APP.user?.id) {
        console.log(`📢 User referred by: ${startParam}`);
        TG.showPopup({
            title: '🎉 Chào mừng!',
            message: 'Bạn đã được giới thiệu bởi một người dùng khác.',
            buttons: [{ type: 'ok', text: 'OK' }]
        });
    }
}

// ============ ADMIN FUNCTIONS ============

function isAdmin() {
    return APP.user?.role === 'admin';
}

async function showAdminPage() {
    if (!isAdmin()) {
        TG.showAlert('❌ Bạn không có quyền truy cập Admin Panel!');
        showPage('buy');
        return;
    }
    showPage('admin');
    await loadAdminPanel();
}

async function loadAdminPanel() {
    if (!isAdmin()) return;
    await loadAdminProducts();
    await loadAdminKeyProducts();
}

async function loadAdminProducts() {
    try {
        const products = await API.getProducts();
        const container = document.getElementById('adminProductList');
        
        if (!products || products.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có sản phẩm</div>';
            return;
        }
        
        let html = '';
        products.forEach(p => {
            html += `
                <div class="admin-list-item">
                    <div class="info">
                        <div class="name">${p.name}</div>
                        <div class="detail">Giá: ${formatPrice(p.price)} | Reseller: ${formatPrice(p.reseller_price)} | Kho: ${p.stock}</div>
                    </div>
                    <div class="actions">
                        <button class="btn-delete" onclick="adminDeleteProduct('${p.id}')">🗑️</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading admin products:', error);
    }
}

async function loadAdminKeyProducts() {
    try {
        const products = await API.getProducts();
        const select = document.getElementById('adminKeyProduct');
        
        select.innerHTML = '<option value="">Chọn sản phẩm</option>';
        products.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    } catch (error) {
        console.error('Error loading key products:', error);
    }
}

async function adminAddProduct() {
    if (!isAdmin()) {
        TG.showAlert('❌ Bạn không có quyền!');
        return;
    }
    
    const name = document.getElementById('adminProductName').value;
    const pkg = document.getElementById('adminProductPackage').value;
    const price = parseInt(document.getElementById('adminProductPrice').value);
    const resellerPrice = parseInt(document.getElementById('adminResellerPrice').value);
    const stock = parseInt(document.getElementById('adminProductStock').value);
    
    if (!name || !pkg || !price || !resellerPrice || !stock) {
        TG.showAlert('⚠️ Vui lòng nhập đầy đủ thông tin!');
        return;
    }
    
    try {
        const result = await API.addProduct(APP.user.id, {
            name, package: pkg, price, reseller_price: resellerPrice, stock
        });
        
        if (result.success) {
            TG.showAlert('✅ Thêm sản phẩm thành công!');
            document.getElementById('adminProductName').value = '';
            document.getElementById('adminProductPackage').value = '';
            document.getElementById('adminProductPrice').value = '';
            document.getElementById('adminResellerPrice').value = '';
            document.getElementById('adminProductStock').value = '';
            await loadAdminProducts();
            await loadProducts();
        }
    } catch (error) {
        TG.showAlert('❌ Có lỗi xảy ra: ' + error.message);
    }
}

async function adminAddKeys() {
    if (!isAdmin()) {
        TG.showAlert('❌ Bạn không có quyền!');
        return;
    }
    
    const productId = document.getElementById('adminKeyProduct').value;
    const keyList = document.getElementById('adminKeyList').value;
    
    if (!productId) {
        TG.showAlert('⚠️ Vui lòng chọn sản phẩm!');
        return;
    }
    
    if (!keyList.trim()) {
        TG.showAlert('⚠️ Vui lòng nhập key!');
        return;
    }
    
    const keys = keyList.split('\n').filter(k => k.trim());
    TG.showAlert(`✅ Đã thêm ${keys.length} key! (Chức năng đang phát triển)`);
    document.getElementById('adminKeyList').value = '';
}

async function adminAddReseller() {
    if (!isAdmin()) {
        TG.showAlert('❌ Bạn không có quyền!');
        return;
    }
    
    const targetId = document.getElementById('adminResellerId').value.trim();
    const discount = parseInt(document.getElementById('adminResellerDiscount').value) || 30;
    
    if (!targetId) {
        TG.showAlert('⚠️ Vui lòng nhập ID Telegram!');
        return;
    }
    
    try {
        const result = await API.setUserRole(APP.user.id, targetId, 'reseller', discount);
        if (result.success) {
            TG.showAlert(`✅ Đã set ${targetId} thành Reseller!`);
            document.getElementById('adminResellerId').value = '';
            await loadAdminPanel();
        }
    } catch (error) {
        TG.showAlert('❌ Có lỗi xảy ra: ' + error.message);
    }
}

async function adminDeleteProduct(productId) {
    if (!isAdmin()) {
        TG.showAlert('❌ Bạn không có quyền!');
        return;
    }
    
    const confirmed = await TG.showConfirm('Bạn có chắc muốn xóa sản phẩm này?');
    if (!confirmed) return;
    
    TG.showAlert('✅ Đã xóa sản phẩm! (Chức năng đang phát triển)');
    await loadAdminProducts();
    await loadProducts();
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', initApp);

// ============ EXPOSE ============
window.showPage = showPage;
window.buyProduct = buyProduct;
window.recharge = recharge;
window.rechargeCustom = rechargeCustom;
window.loadTop = loadTop;
window.loadProfile = loadProfile;
window.copyRefLink = copyRefLink;
window.showAdminPage = showAdminPage;
window.adminAddProduct = adminAddProduct;
window.adminAddKeys = adminAddKeys;
window.adminAddReseller = adminAddReseller;
window.adminDeleteProduct = adminDeleteProduct;
