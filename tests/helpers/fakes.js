class FakeNode {
  constructor({ isVideo = false, videos = [] } = {}) {
    this.isVideo = isVideo;
    this.videos = videos;
  }

  matches(selector) {
    return selector === "video" && this.isVideo;
  }

  querySelectorAll(selector) {
    return selector === "video" ? this.videos : [];
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement extends FakeNode {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.shadowRoot = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.value = "";
    this.textContent = "";
    this.disabled = false;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  remove() {
    if (!this.parentNode) {
      return;
    }

    const siblings = this.parentNode.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  attachShadow({ mode }) {
    this.shadowRoot = new FakeShadowRoot(this, mode);
    return this.shadowRoot;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name.startsWith("data-")) {
      this.dataset[toCamelCase(name.slice(5))] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  querySelector(selector) {
    return findDescendant(this.children, selector);
  }
}

class FakeShadowRoot extends FakeElement {
  constructor(host, mode) {
    super("#shadow-root", host.ownerDocument);
    this.host = host;
    this.mode = mode;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

class FakeTimers {
  constructor() {
    this.nextId = 1;
    this.callbacks = new Map();
  }

  setTimeout(callback) {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  clearTimeout(id) {
    this.callbacks.delete(id);
  }

  fireAll() {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback());
  }
}

function createEvent(type) {
  return {
    type,
    propagationStopped: false,
    defaultPrevented: false,
    stopPropagation() {
      this.propagationStopped = true;
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, character) => character.toUpperCase());
}

function findDescendant(children, selector) {
  for (const child of children) {
    if (matchesSelector(child, selector)) {
      return child;
    }
    const nested = findDescendant(child.children, selector);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function matchesSelector(element, selector) {
  const dataMatch = selector.match(/^\[data-([\w-]+)\]$/);
  if (dataMatch) {
    return Object.hasOwn(element.dataset, toCamelCase(dataMatch[1]));
  }

  return element.tagName === selector.toUpperCase();
}

class FakeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    FakeObserver.instances.push(this);
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.disconnected = true;
  }

  emit(records) {
    this.callback(records);
  }

  static reset() {
    FakeObserver.instances = [];
  }
}

module.exports = {
  FakeDocument,
  FakeElement,
  FakeNode,
  FakeObserver,
  FakeTimers,
  createEvent,
};
