/**
 * Auth Controller - AgriPrice v3
 */
(function() {
    const state = window.AgriState;
    const API_BASE = (window.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

    async function login(identifier, password) {
        try {
            const body = {};
            if (identifier.includes('@')) {
                body.email = identifier;
            } else {
                body.phone = identifier;
            }
            body.password = password;

            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const json = await res.json();
            if (!json.success) throw new Error(json.message);

            // Persist State
            const { token, user } = json.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user_data', JSON.stringify(user));
            
            state.setState({ token, user });

            return json;
        } catch (err) {
            console.error('[Auth] Login error:', err);
            throw err;
        }
    }

    async function sendOtp(phone) {
        try {
            const res = await fetch(`${API_BASE}/auth/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            return json;
        } catch (err) {
            throw err;
        }
    }

    async function verifyOtp(phone, otp) {
        try {
            const res = await fetch(`${API_BASE}/auth/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp })
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            return json;
        } catch (err) {
            throw err;
        }
    }

    async function registerFinish(data) {
        try {
            const res = await fetch(`${API_BASE}/auth/register/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            
            const { token, user } = json.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user_data', JSON.stringify(user));
            state.setState({ token, user });

            return json;
        } catch (err) {
            throw err;
        }
    }

    window.AgriAuth = { login, sendOtp, verifyOtp, registerFinish };
})();
