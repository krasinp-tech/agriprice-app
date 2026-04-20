// utils/auth.js
export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_) {
    return null;
  }
}

export function getRole() {
  const user = getUser();
  return user && user.role ? String(user.role).toLowerCase() : (localStorage.getItem('role') || '').toLowerCase();
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('role');
  sessionStorage.removeItem('redirectAfterAuth');
  if (window.navigateWithTransition) window.navigateWithTransition('/index.html'); else window.location.href = '/index.html';
}

