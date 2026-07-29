const test = require("node:test");
const assert = require("node:assert/strict");
const geometry = require("../src/photo-geometry.js");
const { createPhotoController } = require("../src/photo-controller.js");
const {
  FakeDocument,
  FakeImage,
  FakeObserver,
} = require("./helpers/fakes.js");

function setRect(element, { width, height, left = 0, top = 0 }) {
  element.getBoundingClientRect = () => ({
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
  });
  return element;
}

function createWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter((candidate) => candidate !== listener),
      );
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
    emit(type) {
      for (const listener of listeners.get(type) || []) {
        listener();
      }
    },
  };
}

function createViewer() {
  return {
    closeCalls: 0,
    handler: null,
    openCalls: [],
    states: [],
    setIntentHandler(handler) {
      this.handler = handler;
    },
    open(options) {
      this.openCalls.push(options);
    },
    setState(state) {
      this.states.push({ ...state });
    },
    getViewportRect() {
      return { width: 1000, height: 700, left: 0, top: 0 };
    },
    getImageRect() {
      return { width: 933.3333333333, height: 700, left: 33.3333333333, top: 0 };
    },
    close() {
      this.closeCalls += 1;
    },
  };
}

function createFixture({ kind = "post", complete = true } = {}) {
  FakeObserver.reset();
  const document = new FakeDocument();
  const html = document.createElement("html");
  const body = document.createElement("body");
  document.documentElement = html;
  document.append(html);
  html.append(body);
  document.body = body;
  const mediaRoot = setRect(document.createElement("article"), {
    width: 800,
    height: 700,
  });
  const container = setRect(document.createElement("div"), {
    width: 800,
    height: 600,
  });
  const image = new FakeImage(document, {
    alt: "Bir fotoğraf",
    complete,
    currentSrc: "large-photo.jpg",
    naturalHeight: 600,
    naturalWidth: 800,
    rect: { width: 800, height: 600, left: 0, top: 0 },
    src: "photo.jpg",
  });
  body.append(mediaRoot);
  mediaRoot.append(container);
  container.append(image);
  const trigger = {
    focusCalls: 0,
    host: { isConnected: true },
    focus() {
      this.focusCalls += 1;
    },
  };
  const viewer = createViewer();
  const window = createWindow();
  const controller = createPhotoController({
    context: { image, container, mediaRoot, kind },
    trigger,
    view: viewer,
    document,
    window,
    geometry,
    MutationObserverClass: FakeObserver,
    setTimeout(callback) {
      return { callback };
    },
    clearTimeout() {},
  });
  return {
    container,
    controller,
    document,
    image,
    mediaRoot,
    trigger,
    viewer,
    window,
  };
}

test("open registers intent handling, uses the best source, and fits the image", () => {
  const fixture = createFixture();

  fixture.controller.open();

  assert.equal(fixture.viewer.handler, fixture.controller.handleViewerIntent);
  assert.deepEqual(fixture.viewer.openCalls[0], {
    alt: "Bir fotoğraf",
    hasNext: false,
    hasPrevious: false,
    returnFocus: fixture.trigger,
    src: "large-photo.jpg",
  });
  assert.deepEqual(fixture.viewer.states.at(-1), {
    error: "",
    hasNext: false,
    hasPrevious: false,
    loading: false,
    scale: 1,
    x: 0,
    y: 0,
  });
  assert.equal(fixture.window.listenerCount("resize"), 1);
});

test("wheel zoom is fluid, cursor anchored, and clamped to 1x through 10x", () => {
  const fixture = createFixture();
  fixture.controller.open();

  fixture.controller.handleViewerIntent({
    type: "wheel",
    clientX: 750,
    clientY: 350,
    deltaY: -120,
  });
  const firstZoom = fixture.viewer.states.at(-1);
  const expectedScale = Math.exp(0.18);
  assert.ok(Math.abs(firstZoom.scale - expectedScale) < 1e-10);
  assert.ok(Math.abs(firstZoom.x - (250 - 250 * expectedScale)) < 1e-10);
  assert.equal(firstZoom.y, 0);

  fixture.controller.handleViewerIntent({
    type: "wheel",
    clientX: 500,
    clientY: 350,
    deltaY: -100000,
  });
  assert.equal(fixture.viewer.states.at(-1).scale, 10);

  fixture.controller.handleViewerIntent({
    type: "wheel",
    clientX: 500,
    clientY: 350,
    deltaY: 100000,
  });
  assert.deepEqual(
    {
      scale: fixture.viewer.states.at(-1).scale,
      x: fixture.viewer.states.at(-1).x,
      y: fixture.viewer.states.at(-1).y,
    },
    { scale: 1, x: 0, y: 0 },
  );
});

test("pointer dragging moves only a zoomed image and stays bounded", () => {
  const fixture = createFixture();
  fixture.controller.open();

  fixture.controller.handleViewerIntent({
    type: "pointer-down",
    clientX: 100,
    clientY: 100,
    pointerId: 3,
  });
  fixture.controller.handleViewerIntent({
    type: "pointer-move",
    clientX: 200,
    clientY: 200,
    pointerId: 3,
  });
  assert.equal(fixture.viewer.states.at(-1).scale, 1);

  fixture.controller.handleViewerIntent({ type: "zoom-in" });
  fixture.controller.handleViewerIntent({
    type: "pointer-down",
    clientX: 100,
    clientY: 100,
    pointerId: 4,
  });
  fixture.controller.handleViewerIntent({
    type: "pointer-move",
    clientX: 10000,
    clientY: 10000,
    pointerId: 4,
  });
  fixture.controller.handleViewerIntent({
    type: "pointer-up",
    clientX: 10000,
    clientY: 10000,
    pointerId: 4,
  });

  const dragged = fixture.viewer.states.at(-1);
  assert.equal(dragged.scale, 1.25);
  assert.ok(dragged.x <= (933.3333333333 * 1.25 - 1000) / 2 + 1e-9);
  assert.ok(dragged.y <= (700 * 1.25 - 700) / 2 + 1e-9);
});

test("zoom buttons, reset, image errors, and close share controller state", () => {
  const fixture = createFixture({ complete: false });
  fixture.controller.open();
  assert.equal(fixture.viewer.states.at(-1).loading, true);

  fixture.controller.handleViewerIntent({ type: "zoom-in" });
  assert.equal(fixture.viewer.states.at(-1).scale, 1.25);
  fixture.controller.handleViewerIntent({ type: "zoom-out" });
  assert.equal(fixture.viewer.states.at(-1).scale, 1);
  fixture.controller.handleViewerIntent({ type: "zoom-in" });
  fixture.controller.handleViewerIntent({ type: "reset" });
  assert.deepEqual(
    {
      scale: fixture.viewer.states.at(-1).scale,
      x: fixture.viewer.states.at(-1).x,
      y: fixture.viewer.states.at(-1).y,
    },
    { scale: 1, x: 0, y: 0 },
  );

  fixture.controller.handleViewerIntent({ type: "image-error" });
  assert.deepEqual(fixture.viewer.states.at(-1), {
    error: "Fotoğraf yüklenemedi.",
    loading: false,
  });
  fixture.controller.handleViewerIntent({ type: "close" });
  assert.equal(fixture.viewer.closeCalls, 1);
  assert.equal(fixture.window.listenerCount("resize"), 0);
});

test("carousel navigation switches visible photos and resets zoom", () => {
  const fixture = createFixture();
  const second = new FakeImage(fixture.document, {
    alt: "İkinci fotoğraf",
    complete: true,
    currentSrc: "second-large.jpg",
    naturalHeight: 600,
    naturalWidth: 800,
    rect: { width: 800, height: 600, left: 0, top: 0 },
  });
  fixture.mediaRoot.append(second);

  fixture.controller.open();
  assert.equal(fixture.viewer.openCalls[0].hasNext, true);
  fixture.controller.handleViewerIntent({ type: "zoom-in" });
  fixture.controller.handleViewerIntent({ type: "next" });

  assert.deepEqual(fixture.viewer.states.at(-1), {
    alt: "İkinci fotoğraf",
    error: "",
    hasNext: false,
    hasPrevious: true,
    loading: false,
    scale: 1,
    src: "second-large.jpg",
    x: 0,
    y: 0,
  });
  fixture.controller.handleViewerIntent({ type: "previous" });
  assert.equal(fixture.viewer.states.at(-1).src, "large-photo.jpg");
});

test("native localized carousel control is used when the next photo loads lazily", () => {
  const fixture = createFixture();
  const nextButton = setRect(fixture.document.createElement("button"), {
    width: 40,
    height: 40,
  });
  nextButton.setAttribute("aria-label", "İleri");
  nextButton.clickCalls = 0;
  nextButton.click = () => {
    nextButton.clickCalls += 1;
  };
  fixture.mediaRoot.append(nextButton);
  fixture.controller.open();

  fixture.controller.handleViewerIntent({ type: "next" });
  assert.equal(nextButton.clickCalls, 1);

  const second = new FakeImage(fixture.document, {
    alt: "Tembel yüklenen fotoğraf",
    complete: true,
    currentSrc: "lazy.jpg",
    naturalHeight: 600,
    naturalWidth: 800,
    rect: { width: 800, height: 600, left: 0, top: 0 },
  });
  fixture.mediaRoot.append(second);
  FakeObserver.instances.at(-1).emit([{ addedNodes: [second] }]);

  assert.equal(fixture.viewer.states.at(-1).src, "lazy.jpg");
});

test("a running photo Story pauses on open and resumes only when closed", () => {
  const fixture = createFixture({ kind: "story" });
  const toggle = setRect(fixture.document.createElement("button"), {
    width: 36,
    height: 36,
  });
  toggle.setAttribute("aria-label", "Duraklat");
  toggle.clickCalls = 0;
  toggle.click = () => {
    toggle.clickCalls += 1;
    toggle.setAttribute(
      "aria-label",
      toggle.getAttribute("aria-label") === "Duraklat" ? "Oynat" : "Duraklat",
    );
  };
  fixture.mediaRoot.append(toggle);

  fixture.controller.open();
  assert.equal(toggle.clickCalls, 1);
  assert.equal(toggle.getAttribute("aria-label"), "Oynat");

  fixture.controller.close();
  assert.equal(toggle.clickCalls, 2);
  assert.equal(toggle.getAttribute("aria-label"), "Duraklat");
});

test("an already paused or ambiguous Story is never changed", () => {
  const fixture = createFixture({ kind: "story" });
  const play = setRect(fixture.document.createElement("button"), {
    width: 36,
    height: 36,
  });
  play.setAttribute("aria-label", "Oynat");
  play.clickCalls = 0;
  play.click = () => {
    play.clickCalls += 1;
  };
  fixture.mediaRoot.append(play);

  fixture.controller.open();
  fixture.controller.close();
  assert.equal(play.clickCalls, 0);
});

test("disconnecting the source closes and destroy removes every live listener", () => {
  const fixture = createFixture();
  fixture.controller.open();
  fixture.image.isConnected = false;
  FakeObserver.instances[0].emit([{ removedNodes: [fixture.image] }]);
  assert.equal(fixture.viewer.closeCalls, 1);

  fixture.controller.destroy();
  fixture.controller.destroy();
  assert.equal(fixture.window.listenerCount("resize"), 0);
  assert.equal(FakeObserver.instances[0].disconnected, true);
});
