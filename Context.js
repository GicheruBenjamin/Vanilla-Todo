// Context.js
// Scoped context with provider registration and subscriptions.

export class Context {
    constructor(defaultValue) {
      this.defaultValue = defaultValue;
      this.providers = new WeakMap(); // element -> { value, subs:Set }
      this.globalSubs = new Set();    // subscribers to defaultValue
    }
  
    // Provider management
    registerProvider(element, value = this.defaultValue) {
      if (!(element instanceof HTMLElement)) throw new Error("Provider element must be an HTMLElement");
      this.providers.set(element, { value, subs: new Set() });
    }
    unregisterProvider(element) {
      this.providers.delete(element);
    }
    hasProvider(element) {
      return this.providers.has(element);
    }
  
    // Get current value (scoped or global)
    getValue(providerElement = null) {
      if (providerElement && this.providers.has(providerElement)) {
        return this.providers.get(providerElement).value;
      }
      return this.defaultValue;
    }
  
    // Subscribe to updates (returns unsubscribe)
    subscribe(fn, { providerElement = null } = {}) {
      if (providerElement && this.providers.has(providerElement)) {
        const entry = this.providers.get(providerElement);
        entry.subs.add(fn);
        return () => entry.subs.delete(fn);
      } else {
        this.globalSubs.add(fn);
        return () => this.globalSubs.delete(fn);
      }
    }
  
    // Update value (scoped or global) and notify subscribers
    set(valueOrUpdater, { providerElement = null } = {}) {
      if (providerElement && this.providers.has(providerElement)) {
        const entry = this.providers.get(providerElement);
        entry.value = typeof valueOrUpdater === "function" ? valueOrUpdater(entry.value) : valueOrUpdater;
        entry.subs.forEach(s => { try { s(entry.value); } catch {} });
      } else {
        this.defaultValue = typeof valueOrUpdater === "function" ? valueOrUpdater(this.defaultValue) : valueOrUpdater;
        this.globalSubs.forEach(s => { try { s(this.defaultValue); } catch {} });
      }
    }
  }
  
  // Helper to create contexts (ergonomic)
  export function createContext(defaultValue) {
    return new Context(defaultValue);
  }
  