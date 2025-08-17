// Router.js
// Simple client-side router using History API, mounting Components into a mountPoint.

export default class Router {
    constructor({ mountPoint = document.body } = {}) {
      this.mountPoint = typeof mountPoint === "string" ? document.querySelector(mountPoint) : mountPoint;
      if (!(this.mountPoint instanceof HTMLElement)) throw new Error("Router mountPoint not found");
  
      this.routes = new Map();        // path -> () => Component
      this.currentComponent = null;
  
      this._onPop = this._onPop.bind(this);
      window.addEventListener("popstate", this._onPop);
    }
  
    register(path, componentFactory) { this.routes.set(path, componentFactory); return this; }
    remove(path) { this.routes.delete(path); return this; }
  
    replace(path) {
      this.#navigate(path, "replace");
    }
  
    push(path) {
      this.#navigate(path, "push");
    }
  
    #navigate(path, mode) {
      const factory = this.routes.get(path);
      if (!factory) throw new Error(`No route registered for "${path}"`);
      if (this.currentComponent) this.currentComponent.remove();
      const comp = factory();
      comp.mount(this.mountPoint);
      this.currentComponent = comp;
      const state = { path };
      if (mode === "replace") history.replaceState(state, "", path);
      else history.pushState(state, "", path);
    }
  
    _onPop(e) {
      const path = (e.state && e.state.path) || location.pathname;
      const factory = this.routes.get(path);
      if (!factory) return;
      if (this.currentComponent) this.currentComponent.remove();
      const comp = factory();
      comp.mount(this.mountPoint);
      this.currentComponent = comp;
    }
  
    destroy() {
      if (this.currentComponent) this.currentComponent.remove();
      window.removeEventListener("popstate", this._onPop);
      this.routes.clear();
    }
  }
  