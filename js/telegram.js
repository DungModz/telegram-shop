const TG = {
    webApp: null,
    user: null,
    initData: '',
    initDataUnsafe: null,
    isReady: false,

    init() {
        try {
            this.webApp = window.Telegram.WebApp;
            this.initData = this.webApp.initData || '';
            this.initDataUnsafe = this.webApp.initDataUnsafe || {};
            this.user = this.initDataUnsafe?.user || null;
            this.isReady = true;

            document.documentElement.style.setProperty('--tg-bg-color', this.webApp.backgroundColor || '#0a0a12');
            document.documentElement.style.setProperty('--tg-text-color', this.webApp.textColor || '#ffffff');
            
            this.webApp.expand();
            this.webApp.enableClosingConfirmation();
            
            console.log('✅ Telegram WebApp initialized', this.user);
            return this.user;
        } catch (error) {
            console.error('❌ Telegram WebApp init error:', error);
            return null;
        }
    },

    showPopup(options) {
        return new Promise((resolve) => {
            this.webApp.showPopup(options, (btnId) => {
                resolve(btnId);
            });
        });
    },

    showAlert(message) {
        this.webApp.showAlert(message);
    },

    showConfirm(message) {
        return new Promise((resolve) => {
            this.webApp.showPopup({
                title: 'Xác nhận',
                message: message,
                buttons: [
                    { type: 'cancel', text: 'Hủy' },
                    { type: 'ok', text: 'Xác nhận' }
                ]
            }, (btnId) => {
                resolve(btnId === 'ok');
            });
        });
    },

    haptic(type = 'light') {
        try {
            this.webApp.HapticFeedback.impactOccurred(type);
        } catch (e) {}
    },

    close() {
        this.webApp.close();
    },

    get isMobile() {
        return this.webApp.platform === 'ios' || this.webApp.platform === 'android';
    },

    get isDarkMode() {
        return this.webApp.colorScheme === 'dark';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TG.init();
});
