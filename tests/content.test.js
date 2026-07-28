const test = require("node:test");
const assert = require("node:assert/strict");
const { FakeDocument, FakeObserver, FakeVideo } = require("./helpers/fakes.js");
const { findOverlayContainer, start } = require("../src/content.js");

function setRect(element, width, height) {
  element.getBoundingClientRect = () => ({ width, height });
  return element;
}

function append(parent, child) {
  parent.append(child);
  child.parentElement = parent;
  return child;
}

function createDocumentTree() {
  const document = new FakeDocument();
  const html = document.createElement("html");
  const body = document.createElement("body");
  document.documentElement = html;
  append(document, html);
  html.parentElement = null;
  append(html, body);
  document.body = body;
  return { body, document, html };
}

function createWindow(positionFor = () => "static") {
  return {
    getComputedStyle(element) {
      return { position: positionFor(element) };
    },
  };
}

function createStartFixture({ positionFor } = {}) {
  FakeObserver.reset();
  const { body, document, html } = createDocumentTree();
  const discoveryCalls = [];
  const viewCalls = [];
  const controllerCalls = [];
  let discoveryStartCalls = 0;
  let discoveryStopCalls = 0;
  const discoveryFactory = (options) => {
    discoveryCalls.push(options);
    return {
      start() {
        discoveryStartCalls += 1;
      },
      stop() {
        discoveryStopCalls += 1;
      },
    };
  };
  const viewFactory = (options) => {
    const view = { id: viewCalls.length + 1 };
    viewCalls.push({ options, view });
    return view;
  };
  const controllerFactory = (options) => {
    const controller = {
      destroyed: 0,
      intents: [],
      destroy() {
        this.destroyed += 1;
      },
      handleIntent(intent) {
        this.intents.push(intent);
        return `handled:${intent.type}`;
      },
    };
    controllerCalls.push({ controller, options });
    return controller;
  };
  const window = createWindow(positionFor);

  const lifecycle = start({
    document,
    window,
    MutationObserverClass: FakeObserver,
    discoveryFactory,
    viewFactory,
    controllerFactory,
  });

  return {
    body,
    controllerCalls,
    discoveryCalls,
    get discoveryStartCalls() {
      return discoveryStartCalls;
    },
    get discoveryStopCalls() {
      return discoveryStopCalls;
    },
    document,
    html,
    lifecycle,
    viewCalls,
    window,
  };
}

function discover(fixture, video) {
  fixture.discoveryCalls[0].enhance(video);
}

test("findOverlayContainer chooses the nearest non-root ancestor with an approximately matching rectangle", () => {
  const { body, document } = createDocumentTree();
  const matchingOuter = setRect(document.createElement("div"), 316, 184);
  const matchingInner = setRect(document.createElement("div"), 323, 177);
  const mismatchingParent = setRect(document.createElement("div"), 280, 180);
  const video = setRect(new FakeVideo(document), 320, 180);
  append(body, matchingOuter);
  append(matchingOuter, matchingInner);
  append(matchingInner, mismatchingParent);
  append(mismatchingParent, video);

  assert.equal(findOverlayContainer(video, createWindow()), matchingInner);
});

test("findOverlayContainer falls back to the video parent when no eligible ancestor matches", () => {
  const { body, document, html } = createDocumentTree();
  const parent = setRect(document.createElement("div"), 500, 400);
  const video = setRect(new FakeVideo(document), 320, 180);
  setRect(body, 320, 180);
  setRect(html, 320, 180);
  append(body, parent);
  append(parent, video);

  assert.equal(findOverlayContainer(video, createWindow()), parent);
});

test("start positions only static containers and passes that same container through composition", () => {
  const fixture = createStartFixture({
    positionFor: (element) => element.computedPosition || "static",
  });
  const staticContainer = setRect(fixture.document.createElement("div"), 320, 180);
  const positionedContainer = setRect(fixture.document.createElement("div"), 320, 180);
  positionedContainer.computedPosition = "absolute";
  positionedContainer.style.position = "absolute";
  const staticVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  const positionedVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, staticContainer);
  append(staticContainer, staticVideo);
  append(fixture.body, positionedContainer);
  append(positionedContainer, positionedVideo);

  discover(fixture, staticVideo);
  discover(fixture, positionedVideo);

  assert.equal(staticContainer.style.position, "relative");
  assert.equal(positionedContainer.style.position, "absolute");
  assert.equal(fixture.viewCalls[0].options.container, staticContainer);
  assert.equal(fixture.controllerCalls[0].options.container, staticContainer);
  assert.equal(fixture.viewCalls[1].options.container, positionedContainer);
  assert.equal(fixture.controllerCalls[1].options.container, positionedContainer);
  fixture.lifecycle.stop();
});

test("an already enhanced video never receives a second view or controller", () => {
  const fixture = createStartFixture();
  const container = setRect(fixture.document.createElement("div"), 320, 180);
  const video = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, container);
  append(container, video);

  discover(fixture, video);
  discover(fixture, video);

  assert.equal(fixture.viewCalls.length, 1);
  assert.equal(fixture.controllerCalls.length, 1);
  fixture.lifecycle.stop();
});

test("view intents are forwarded to the controller created for the video", () => {
  const fixture = createStartFixture();
  const container = setRect(fixture.document.createElement("div"), 320, 180);
  const video = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, container);
  append(container, video);
  discover(fixture, video);
  const intent = { type: "toggle-play" };

  const result = fixture.viewCalls[0].options.onIntent(intent);

  assert.equal(result, "handled:toggle-play");
  assert.deepEqual(fixture.controllerCalls[0].controller.intents, [intent]);
  fixture.lifecycle.stop();
});

test("stop stops discovery, destroys every live controller, and restores changed inline positions", () => {
  const fixture = createStartFixture();
  const firstContainer = setRect(fixture.document.createElement("div"), 320, 180);
  const secondContainer = setRect(fixture.document.createElement("div"), 320, 180);
  firstContainer.style.position = "static";
  const firstVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  const secondVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, firstContainer);
  append(firstContainer, firstVideo);
  append(fixture.body, secondContainer);
  append(secondContainer, secondVideo);
  discover(fixture, firstVideo);
  discover(fixture, secondVideo);

  fixture.lifecycle.stop();
  fixture.lifecycle.stop();

  assert.equal(fixture.discoveryStartCalls, 1);
  assert.equal(fixture.discoveryStopCalls, 1);
  assert.deepEqual(fixture.controllerCalls.map(({ controller }) => controller.destroyed), [1, 1]);
  assert.equal(firstContainer.style.position, "static");
  assert.equal(secondContainer.style.position, undefined);
  assert.equal(FakeObserver.instances[0].disconnected, true);
});

test("a document removal destroys only disconnected videos and restores their container position", () => {
  const fixture = createStartFixture();
  const removedContainer = setRect(fixture.document.createElement("div"), 320, 180);
  const liveContainer = setRect(fixture.document.createElement("div"), 320, 180);
  const removedVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  const liveVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, removedContainer);
  append(removedContainer, removedVideo);
  append(fixture.body, liveContainer);
  append(liveContainer, liveVideo);
  removedVideo.isConnected = true;
  liveVideo.isConnected = true;
  discover(fixture, removedVideo);
  discover(fixture, liveVideo);
  removedContainer.remove();
  removedVideo.isConnected = false;

  FakeObserver.instances[0].emit([{ removedNodes: [removedContainer] }]);

  assert.equal(fixture.controllerCalls[0].controller.destroyed, 1);
  assert.equal(fixture.controllerCalls[1].controller.destroyed, 0);
  assert.equal(removedContainer.style.position, undefined);
  assert.equal(liveContainer.style.position, "relative");
  fixture.lifecycle.stop();
  assert.equal(fixture.controllerCalls[0].controller.destroyed, 1);
  assert.equal(fixture.controllerCalls[1].controller.destroyed, 1);
});
