/**
 * Login Controller - AgriPrice v3
 */
(function() {
    const auth = window.AgriAuth;
    const form = document.getElementById('loginForm');
    const errBox = document.getElementById('formError');
    const btn = document.getElementById('loginBtn');

    async function handleLogin(e) {
        e.preventDefault();
        const identifier = document.getElementById('identifier').value;
        const password = document.getElementById('password').value;

        if (!identifier || !password) {
            errBox.textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'กำลังเข้าสู่ระบบ...';
        errBox.textContent = '';

        try {
            await auth.login(identifier, password);
            window.location.href = '../../index.html';
        } catch (err) {
            errBox.textContent = err.message;
            btn.disabled = false;
            btn.textContent = 'เข้าสู่ระบบ';
        }
    }

    form.addEventListener('submit', handleLogin);
})();
