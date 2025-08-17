// Component.js
// Minimal class-based UI component with batched state updates + tiny hooks.

export default class Component {
    constructor(tagOrEl = "div", props = {}) {
      // Resolve element: tag name, selector, or HTMLElement
      if (typeof tagOrEl === "string") {
        if (tagOrEl.startsWith("#") || tagOrEl.startsWith(".")) {
          const found = document.querySelector(tagOrEl);
          if (!found) throw new Error(`No element found for selector: ${tagOrEl}`);
          this.element = found;
        } else {
          this.element = document.createElement(tagOrEl);
        }
      } else if (tagOrEl instanceof HTMLElement) {
        this.element = tagOrEl;
      } else {
        throw new Error("tagOrEl must be a tag name, selector, or HTMLElement");
      }
  
      // Basic props → DOM
      this.props = props || {};
      if (props.id) this.element.id = props.id;
      if (props.className) this.element.className = props.className;
      if (props.style && typeof props.style === "object") Object.assign(this.element.style, props.style);
      if (props.attributes && typeof props.attributes === "object") {
        for (const [k, v] of Object.entries(props.attributes)) this.element.setAttribute(k, v);
      }
      if (typeof props.textContent === "string") this.element.textContent = props.textContent;
  
      // Children (Components | HTMLElements | strings)
      this.childrenComponents = [];
      if (props.children) {
        const append = (child) => {
          if (child instanceof Component) {
            this.element.appendChild(child.render());
            this.childrenComponents.push(child);
          } else if (child instanceof HTMLElement) {
            this.element.appendChild(child);
          } else if (typeof child === "string") {
            this.element.appendChild(document.createTextNode(child));
          } else {
            throw new Error("Invalid child type");
          }
        };
        Array.isArray(props.children) ? props.children.forEach(append) : append(props.children);
      }
  
      // Events
      this.eventListeners = [];
      if (props.events && typeof props.events === "object") {
        for (const [evt, handler] of Object.entries(props.events)) {
          if (typeof handler === "function") {
            const bound = handler.bind(this);
            this.element.addEventListener(evt, bound);
            this.eventListeners.push({ evt, bound });
          }
        }
      }
  
      // Reactive state with batching
      this.boundElements = {};              // key -> nodes[]
      this.__pendingKeys = new Set();       // changed keys in this tick
      this.__flushScheduled = false;        // microtask scheduled?
      this.__isMounted = false;
  
      const initial = { ...(props.initialState || {}) };
      this.state = new Proxy(initial, {
        set: (target, key, value) => {
          if (target[key] === value) return true; // no-op
          target[key] = value;
          this.__pendingKeys.add(key);
          if (!this.__flushScheduled) {
            this.__flushScheduled = true;
            queueMicrotask(() => this.__flush());
          }
          return true;
        }
      });
  
      // Hook-ish infra
      this.__hookCounter = 0;
      this.__hookMeta = [];   // per-hook {deps, cleanup}
      this.__effectQueue = []; // effects to run after flush
    }
  
    // ---------- Lifecycle (override, or pass via props: onMount/onUpdate/onUnmount)
    onMount()  { if (typeof this.props.onMount === "function") this.props.onMount(this); }
    onUpdate() { if (typeof this.props.onUpdate === "function") this.props.onUpdate(this); }
    onUnmount(){ if (typeof this.props.onUnmount=== "function") this.props.onUnmount(this); }
  
    mount(target) {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      if (!(el instanceof HTMLElement)) throw new Error("mount target must be an HTMLElement or selector");
      el.appendChild(this.element);
      this.__isMounted = true;
      this.onMount();
      return this;
    }
  
    remove() {
      this.onUnmount();
  
      // Cleanup effects
      for (const meta of this.__hookMeta) {
        if (meta?.cleanup && typeof meta.cleanup === "function") {
          try { meta.cleanup(); } catch {}
          meta.cleanup = null;
        }
      }
  
      // Remove child components (recursive)
      this.childrenComponents.forEach(c => c instanceof Component && c.remove());
      this.childrenComponents = [];
  
      // Remove events
      this.eventListeners.forEach(({ evt, bound }) => this.element.removeEventListener(evt, bound));
      this.eventListeners = [];
  
      // Detach
      if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
      this.__isMounted = false;
    }
  
    render() { return this.element; }
  
    // ---------- Batching flush (update bound nodes once per microtask, then onUpdate + effects)
    __flush() {
      // Update bound text nodes for changed keys
      this.__pendingKeys.forEach(key => {
        const nodes = this.boundElements[key];
        if (!nodes) return;
        const val = this.state[key] ?? "";
        nodes.forEach(n => { try { n.textContent = val; } catch {} });
      });
      this.__pendingKeys.clear();
      this.__flushScheduled = false;
  
      // Lifecycle update
      try { this.onUpdate(); } catch (e) { console.error(e); }
  
      // Run queued effects (may register cleanups)
      const effects = this.__effectQueue.slice();
      this.__effectQueue.length = 0;
      for (const eff of effects) {
        try {
          const cleanup = eff.effect();
          if (typeof cleanup === "function") eff.meta.cleanup = cleanup;
        } catch (e) {
          console.error("Effect error:", e);
        }
      }
    }
  
    // ---------- Public state helpers
    setState(partial) {
      if (typeof partial !== "object" || partial === null) throw new Error("setState expects an object");
      for (const [k, v] of Object.entries(partial)) this.state[k] = v;
    }
  
    bindText(key, node) {
      if (!this.boundElements[key]) this.boundElements[key] = [];
      this.boundElements[key].push(node);
      node.textContent = this.state[key] ?? "";
    }
  
    // ---------- Hook-like APIs (simple & predictable; call order must be stable)
    useState(initial) {
      const idx = this.__hookCounter++;
      const key = `__hook_state_${idx}`;
      if (!(key in this.state)) this.state[key] = typeof initial === "function" ? initial() : initial;
      const get = () => this.state[key];
      const set = (updater) => {
        const next = typeof updater === "function" ? updater(this.state[key]) : updater;
        this.state[key] = next;
      };
      return [get, set, key]; // return key so you can bindText if you want
    }
  
    useReducer(reducer, initial) {
      const [get, set] = this.useState(typeof initial === "function" ? initial() : initial);
      const dispatch = (action) => set(prev => reducer(prev, action));
      return [get, dispatch];
    }
  
    useEffect(effect, deps) {
      const idx = this.__hookCounter++;
      const meta = this.__hookMeta[idx] ||= {};
      const prev = meta.deps;
  
      let changed = false;
      if (!prev || !deps || prev.length !== deps.length) changed = true;
      else for (let i = 0; i < deps.length; i++) if (prev[i] !== deps[i]) { changed = true; break; }
  
      if (changed) {
        if (meta.cleanup && typeof meta.cleanup === "function") { try { meta.cleanup(); } catch {} meta.cleanup = null; }
        meta.deps = deps ? deps.slice() : undefined;
        meta.effect = effect;
        this.__effectQueue.push({ effect, meta });
        if (!this.__flushScheduled) { this.__flushScheduled = true; queueMicrotask(() => this.__flush()); }
      }
    }
  
    // useContext is implemented in terms of Context.subscribe (see Context.js)
    useContext(context) {
      if (!context || typeof context.subscribe !== "function") {
        throw new Error("useContext expects a Context instance");
      }
  
      // Find nearest provider by walking up DOM
      let node = this.element;
      let providerElement = null;
      while (node && node !== document.documentElement) {
        if (context.hasProvider(node)) { providerElement = node; break; }
        node = node.parentNode;
      }
  
      // Prime local slot with current value so effects can depend on it
      const [getVal, setVal] = this.useState(context.getValue(providerElement));
  
      // Subscribe to updates for that scope
      const unsubscribe = context.subscribe((nextValue) => {
        setVal(nextValue); // goes through batching
      }, { providerElement });
  
      // Ensure we unsubscribe on unmount
      this.useEffect(() => unsubscribe, []); // run once, cleanup unsubscribes
  
      return getVal(); // return current value
    }
  }
  