// App.js
// Root orchestrator tying together Contexts, Components, and Router.

import Router from "./Router.js";
import Component from "./Component.js";
import { Context } from "./Context.js";

export default class App {
  constructor({ mountPoint = document.body, routes = {}, providers = [] } = {}) {
    this.mountPoint = typeof mountPoint === "string" ? document.querySelector(mountPoint) : mountPoint;
    if (!(this.mountPoint instanceof HTMLElement)) throw new Error("App mountPoint not found");

    // Register top-level context providers (scope to entire app subtree)
    // providers: [{ context: ContextInstance, value }]
    providers.forEach(({ context, value }) => {
      if (!(context instanceof Context)) throw new Error("providers.context must be a Context");
      context.registerProvider(this.mountPoint, value);
    });

    // Router
    this.router = new Router({ mountPoint: this.mountPoint });
    Object.entries(routes).forEach(([path, factory]) => this.router.register(path, factory));
  }

  addRoute(path, factory) { this.router.register(path, factory); return this; }
  removeRoute(path) { this.router.remove(path); return this; }

  setRoute(path, { replace = false } = {}) {
    replace ? this.router.replace(path) : this.router.push(path);
  }

  // Provide / update / remove app-scoped contexts
  provide(context, value) {
    if (!(context instanceof Context)) throw new Error("provide() expects a Context");
    context.registerProvider(this.mountPoint, value);
  }
  updateContext(context, updater) {
    if (!(context instanceof Context)) throw new Error("updateContext() expects a Context");
    context.set(updater, { providerElement: this.mountPoint });
  }
  removeContext(context) {
    if (!(context instanceof Context)) throw new Error("removeContext() expects a Context");
    context.unregisterProvider(this.mountPoint);
  }

  destroy() {
    this.router.destroy();
  }
}
