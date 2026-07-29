class FakeNode {
  constructor({ images = [], isImage = false, isVideo = false, videos = [] } = {}) {
    this.images = images;
    this.isImage = isImage;
    this.isVideo = isVideo;
    this.videos = videos;
  }

  matches(selector) {
    return (
      (selector === "video" && this.isVideo) ||
      (selector === "img" && this.isImage)
    );
  }

  querySelectorAll(selector) {
    if (selector === "video") {
      return this.videos;
    }
    if (selector === "img") {
      return this.images;
    }
    return [];
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => {
      if (name === "") {
        throw new SyntaxError("The token provided must not be empty.");
      }
      this.values.add(name);
    });
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
    this.hidden = false;
    this.capturedPointers = new Set();
    this.isConnected = true;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      node.parentElement = this.tagName === "#DOCUMENT" ? null : this;
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
    this.parentElement = null;
    this.isConnected = false;
  }

  contains(node) {
    if (this === node) {
      return true;
    }
    return this.children.some((child) =>
      typeof child.contains === "function" ? child.contains(node) : child === node,
    );
  }

  attachShadow({ mode }) {
    this.shadowRoot = new FakeShadowRoot(this, mode);
    this.shadowRoot.parentNode = this;
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

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((registered) => registered !== listener));
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    let currentTarget = this;
    while (currentTarget) {
      event.currentTarget = currentTarget;
      for (const listener of currentTarget.listeners.get(event.type) || []) {
        listener(event);
      }
      if (event.propagationStopped || event.bubbles === false) {
        break;
      }
      currentTarget = currentTarget.parentNode;
    }
    return !event.defaultPrevented;
  }

  dispatchPointerEvent(type) {
    if (this.style.pointerEvents === "none") {
      return null;
    }

    const event = createEvent(type);
    this.dispatchEvent(event);
    return event;
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(createEvent("focus"));
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.add(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointers.has(pointerId);
  }

  querySelector(selector) {
    return findDescendant(this.children, selector);
  }

  querySelectorAll(selector) {
    return findDescendants(this.children, selector);
  }

  closest(selector) {
    let candidate = this;
    while (candidate) {
      if (matchesSelector(candidate, selector)) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return null;
  }
}

class FakeShadowRoot extends FakeElement {
  constructor(host, mode) {
    super("#shadow-root", host.ownerDocument);
    this.host = host;
    this.mode = mode;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document", null);
    this.ownerDocument = this;
    this.fullscreenElement = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createElementNS(namespaceURI, tagName) {
    const element = new FakeElement(tagName, this);
    element.namespaceURI = namespaceURI;
    return element;
  }
}

class FakeVideo extends FakeElement {
  constructor(ownerDocument, {
    currentTime = 0,
    duration = Number.NaN,
    muted = false,
    paused = true,
    playbackRate = 1,
    volume = 1,
  } = {}) {
    super("video", ownerDocument);
    this.currentTime = currentTime;
    this.duration = duration;
    this.muted = muted;
    this.paused = paused;
    this.playbackRate = playbackRate;
    this.volume = volume;
    this.playError = null;
    this.playCalls = 0;
    this.pauseCalls = 0;
  }

  play() {
    this.playCalls += 1;
    if (this.playError) {
      return Promise.reject(this.playError);
    }

    this.paused = false;
    this.dispatchEvent(createEvent("play"));
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
    this.dispatchEvent(createEvent("pause"));
  }
}

class FakeImage extends FakeElement {
  constructor(ownerDocument, {
    alt = "",
    complete = true,
    currentSrc = "",
    naturalHeight = 0,
    naturalWidth = 0,
    rect = { height: 0, left: 0, top: 0, width: 0 },
    src = "",
  } = {}) {
    super("img", ownerDocument);
    this.isImage = true;
    this.alt = alt;
    this.complete = complete;
    this.currentSrc = currentSrc;
    this.naturalHeight = naturalHeight;
    this.naturalWidth = naturalWidth;
    this.rect = { ...rect };
    this.src = src;
  }

  getBoundingClientRect() {
    return {
      bottom: this.rect.top + this.rect.height,
      height: this.rect.height,
      left: this.rect.left,
      right: this.rect.left + this.rect.width,
      top: this.rect.top,
      width: this.rect.width,
    };
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

function createEvent(type, { bubbles = true, ...properties } = {}) {
  return {
    type,
    bubbles,
    ...properties,
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

function findDescendants(children, selector, matches = []) {
  for (const child of children) {
    if (matchesSelector(child, selector)) {
      matches.push(child);
    }
    findDescendants(child.children, selector, matches);
  }
  return matches;
}

function matchesSelector(element, selector) {
  if (selector.includes(",")) {
    return selector.split(",").some((part) => matchesSelector(element, part.trim()));
  }

  const dataMatch = selector.match(/^\[data-([\w-]+)\]$/);
  if (dataMatch) {
    return Object.hasOwn(element.dataset, toCamelCase(dataMatch[1]));
  }

  const attributeMatch = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (attributeMatch) {
    const actual = element.getAttribute(attributeMatch[1]);
    return attributeMatch[2] === undefined ? actual !== null : actual === attributeMatch[2];
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
  FakeImage,
  FakeNode,
  FakeObserver,
  FakeTimers,
  FakeVideo,
  createEvent,
};
