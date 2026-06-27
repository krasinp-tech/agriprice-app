/**
 * Simple State Management for AgriPrice v3
 */
class State {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach(callback => callback(this.state));
  }
}

window.AgriState = new State({
  user: JSON.parse(localStorage.getItem('user_data')) || null,
  token: localStorage.getItem('token') || null,
  theme: localStorage.getItem('agriprice_theme') || 'light'
});
