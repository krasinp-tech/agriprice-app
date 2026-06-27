/**
 * Simple Router with View Transitions Support
 */
class Router {
  constructor() {
    this.init();
  }

  init() {
    window.addEventListener('popstate', () => this.handleRoute());
    document.addEventListener('click', e => {
      const anchor = e.target.closest('a');
      if (anchor && anchor.href.startsWith(window.location.origin)) {
        e.preventDefault();
        this.navigate(anchor.getAttribute('href'));
      }
    });
  }

    let targetPath = url;
    try {
      targetPath = new URL(url, window.location.href).pathname;
    } catch (e) {
      console.warn('[Router] Failed to resolve URL:', url, e);
    }

    if (window.location.pathname === targetPath) return;

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.history.pushState({}, '', url);
        this.handleRoute();
      });
    } else {
      window.history.pushState({}, '', url);
      this.handleRoute();
    }
  }

  handleRoute() {
    // In a multi-page app like this, we might actually just let the browser handle it
    // but intercept for specific transitions or "protected" routes.
    // For now, if it's a real page change, we just let it go but provide the transition.
    const path = window.location.pathname;
    console.log('[Router] Navigating to:', path);
    
    // Check Auth Guard
    const protectedPaths = ['/pages/shared/chat', '/pages/farmer/booking', '/pages/account/'];
    const isProtected = protectedPaths.some(p => path.includes(p));
    
    if (isProtected && !window.AgriState.getState().token) {
       window.location.href = '/pages/auth/login1.html';
       return;
    }

    // Since this is a legacy-structured app with separate HTML files, 
    // real navigation is often better. But we can AJAX load content for speed.
    // For the "rewrite," I'll keep real navigation but wrap it in transitions.
    window.location.href = window.location.href; 
  }
}

window.AgriRouter = new Router();
