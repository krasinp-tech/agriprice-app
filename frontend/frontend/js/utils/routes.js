// utils/routes.js
export function getProjectBasePath() {
  const path = window.location.pathname;
  const pagesIdx = path.indexOf('/pages/');
  if (pagesIdx !== -1) {
    return path.substring(0, pagesIdx + 1);
  }
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0) {
    return '/' + parts[0] + '/';
  }
  return '/';
}

export function goLogin(nextPath) {
  const base = getProjectBasePath();
  const url = new URL(base + 'pages/auth/login1.html', window.location.origin);
  url.searchParams.set('next', nextPath);
  if (window.navigateWithTransition) window.navigateWithTransition(url.toString()); else window.location.href = url.toString();
}

export function redirectAfterLogin(defaultPath) {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('next') || sessionStorage.getItem('redirectAfterAuth');
  sessionStorage.removeItem('redirectAfterAuth');
  if (explicit) {
    if (window.navigateWithTransition) window.navigateWithTransition(explicit); else window.location.href = explicit;
    return;
  }
  // role-based default home
  let role = '';
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    role = (u && u.role) ? String(u.role).toLowerCase() : (localStorage.getItem('role') || '').toLowerCase();
  } catch (_) {}
  const base = getProjectBasePath();
  if (role === 'buyer') {
    if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + 'pages/buyer/Dashboard/Dashboard1.html'); else window.location.href = defaultPath || base + 'pages/buyer/Dashboard/Dashboard1.html';
  } else if (role === 'farmer') {
    if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + 'index.html'); else window.location.href = defaultPath || base + 'index.html';
  } else {
    if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + 'index.html'); else window.location.href = defaultPath || base + 'index.html';
  }
}

