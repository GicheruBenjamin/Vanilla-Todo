// Functional Todo app with a small store (regular functions, no classes).
// Features: add, update, toggle complete, delete, seed, clear, localStorage persistence, event log.

var TodoApp = (function () {
    // ----- persistence key -----
    var STORAGE_KEY = 'todo_app_v1';
  
    // ----- initial state -----
    var initialState = {
      todos: {},    // id -> { id, text, done, createdAt, updatedAt, version }
      nextId: 1
    };
  
    // ----- load/save -----
    function loadState() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return initialState;
        var parsed = JSON.parse(raw);
        // basic validation
        if (parsed && typeof parsed === 'object' && parsed.todos) return parsed;
        return initialState;
      } catch (e) {
        console.error('loadState error', e);
        return initialState;
      }
    }
  
    function saveState(s) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch (e) {
        console.error('saveState error', e);
      }
    }
  
    // ----- state + listeners -----
    var state = loadState();
    var listeners = new Set();
  
    function subscribe(fn) {
      listeners.add(fn);
      // immediate notify with type 'INIT'
      try { fn({ type: 'INIT', prevState: null, nextState: state, timestamp: Date.now() }); } catch (e) {}
      return function () { listeners.delete(fn); };
    }
  
    function notify(type, payload, prevState, nextState) {
      var evt = { type: type, payload: payload, prevState: prevState, nextState: nextState, timestamp: Date.now() };
      listeners.forEach(function (fn) { try { fn(evt); } catch (e) { console.error(e); } });
    }
  
    // ----- pure reducer -----
    function reducer(s, action) {
      switch (action.type) {
        case 'ADD': {
          var id = s.nextId;
          var now = new Date().toISOString();
          var todo = { id: id, text: action.text, done: false, createdAt: now, updatedAt: now, version: 1 };
          var nextTodos = Object.assign({}, s.todos); nextTodos[id] = todo;
          return { nextId: id + 1, todos: nextTodos };
        }
        case 'UPDATE': {
          var existing = s.todos[action.id];
          if (!existing) return s;
          var nowU = new Date().toISOString();
          var updated = Object.assign({}, existing, action.patch, { updatedAt: nowU, version: existing.version + 1 });
          var todos2 = Object.assign({}, s.todos); todos2[action.id] = updated;
          return { nextId: s.nextId, todos: todos2 };
        }
        case 'DELETE': {
          if (!s.todos[action.id]) return s;
          var todos3 = Object.assign({}, s.todos); delete todos3[action.id];
          return { nextId: s.nextId, todos: todos3 };
        }
        case 'CLEAR': {
          return { nextId: 1, todos: {} };
        }
        case 'TOGGLE_ALL': {
          var allDone = Object.keys(s.todos).every(function (k) { return s.todos[k].done; });
          var toggled = Object.keys(s.todos).reduce(function (acc, k) {
            var t = s.todos[k];
            acc[k] = Object.assign({}, t, { done: !allDone, updatedAt: new Date().toISOString(), version: t.version + 1 });
            return acc;
          }, {});
          return { nextId: s.nextId, todos: toggled };
        }
        default:
          return s;
      }
    }
  
    // ----- dispatch (impure) -----
    function dispatch(action) {
      var prev = state;
      var next = reducer(prev, action);
      // shallow compare
      if (next !== prev) {
        state = next;
        saveState(state);
        notify(action.type, action, prev, next);
      }
      return state;
    }
  
    // ----- API wrappers -----
    function addTodo(text) {
      if (!text || typeof text !== 'string') return null;
      var trimmed = text.trim();
      if (!trimmed) return null;
      dispatch({ type: 'ADD', text: trimmed });
      return getTodos();
    }
  
    function updateTodo(id, patch) {
      dispatch({ type: 'UPDATE', id: id, patch: patch });
      return readTodo(id);
    }
  
    function toggleTodo(id) {
      var t = state.todos[id];
      if (!t) return null;
      updateTodo(id, { done: !t.done });
      return readTodo(id);
    }
  
    function deleteTodo(id) {
      dispatch({ type: 'DELETE', id: id });
      return true;
    }
  
    function clearAll() {
      dispatch({ type: 'CLEAR' });
      return true;
    }
  
    function toggleAll() {
      dispatch({ type: 'TOGGLE_ALL' });
      return getTodos();
    }
  
    function readTodo(id) {
      var t = state.todos[id];
      return t ? Object.assign({}, t) : null;
    }
  
    function getTodos() {
      return Object.keys(state.todos)
        .map(function (k) { return state.todos[k]; })
        .sort(function (a, b) { return a.id - b.id; })
        .map(function (t) { return Object.assign({}, t); });
    }
  
    // ----- seed helper -----
    function seedSample() {
      addTodo('Learn functional patterns in JS');
      addTodo('Build small store + renderer');
      addTodo('Ship the MVP');
    }
  
    // ----- expose API -----
    return {
      subscribe: subscribe,
      addTodo: addTodo,
      updateTodo: updateTodo,
      toggleTodo: toggleTodo,
      deleteTodo: deleteTodo,
      clearAll: clearAll,
      toggleAll: toggleAll,
      readTodo: readTodo,
      getTodos: getTodos,
      seedSample: seedSample
    };
  })();
  
  // =========================
  // UI wiring (regular functions)
  // =========================
  (function () {
    var body = document;
    var input = body.getElementById('new-todo');
    var addBtn = body.getElementById('add-btn');
    var seedBtn = body.getElementById('seed');
    var clearBtn = body.getElementById('clear');
    var tbody = body.getElementById('todos-body');
    var eventsLog = body.getElementById('events');
    var toggleAllBtn = body.getElementById('toggle-all');
  
    function fmtTime(iso) {
      try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
    }
  
    function renderTodos() {
      var todos = TodoApp.getTodos();
      tbody.innerHTML = todos.length ? '' : '<tr><td colspan="4" class="small">No todos yet.</td></tr>';
      for (var i = 0; i < todos.length; i++) {
        var t = todos[i];
        var tr = document.createElement('tr');
  
        var actions = ''
          + '<button data-action="toggle" data-id="' + t.id + '">' + (t.done ? 'Undone' : 'Done') + '</button> '
          + '<button data-action="save" data-id="' + t.id + '">Save</button> '
          + '<button data-action="delete" data-id="' + t.id + '" class="danger">Delete</button>';
  
        tr.innerHTML = ''
          + '<td>' + t.id + '</td>'
          + '<td><input class="edit" data-field="text" data-id="' + t.id + '" value="' + escapeHtml(t.text) + '"/></td>'
          + '<td>' + (t.done ? '✔ Completed' : '— Open') + '<div class="small">' + fmtTime(t.updatedAt) + '</div></td>'
          + '<td>' + actions + '</td>';
  
        tbody.appendChild(tr);
      }
    }
  
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
    }
  
    function logEvent(evt) {
      var type = evt.type;
      var payloadText = JSON.stringify(evt.payload || {});
      var line = '[' + new Date(evt.timestamp).toLocaleTimeString() + '] ' + type + ' ' + payloadText;
      var div = document.createElement('div');
      div.innerText = line;
      eventsLog.appendChild(div);
      eventsLog.scrollTop = eventsLog.scrollHeight;
    }
  
    // Subscribe to store events to re-render / log
    TodoApp.subscribe(function (evt) {
      logEvent(evt);
      renderTodos();
    });
  
    // Add todo
    addBtn.addEventListener('click', function () {
      TodoApp.addTodo(input.value);
      input.value = '';
      input.focus();
    });
  
    // Enter key to add
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { addBtn.click(); }
    });
  
    // Seed / clear / toggle all
    seedBtn.addEventListener('click', function () { TodoApp.seedSample(); });
    clearBtn.addEventListener('click', function () { if (confirm('Clear all todos?')) TodoApp.clearAll(); });
    toggleAllBtn.addEventListener('click', function () { TodoApp.toggleAll(); });
  
    // Delegated table actions
    tbody.addEventListener('click', function (e) {
      var action = e.target && e.target.getAttribute && e.target.getAttribute('data-action');
      var idAttr = e.target && e.target.getAttribute && e.target.getAttribute('data-id');
      if (!action || !idAttr) return;
      var id = Number(idAttr);
      if (action === 'toggle') { TodoApp.toggleTodo(id); }
      if (action === 'delete') { TodoApp.deleteTodo(id); }
      if (action === 'save') {
        var textInput = tbody.querySelector('input[data-id="' + id + '"][data-field="text"]');
        if (textInput) TodoApp.updateTodo(id, { text: textInput.value });
      }
    });
  
    // Optional: live-update patching on input (commented out to avoid noisy updates)
    // tbody.addEventListener('input', function (e) {
    //   var id = e.target && e.target.getAttribute && e.target.getAttribute('data-id');
    //   var field = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
    //   if (!id || !field) return;
    //   // optimistic update (uncomment if you want)
    //   // TodoApp.updateTodo(Number(id), { [field]: e.target.value });
    // });
  
    // initial render
    renderTodos();
  })();
  