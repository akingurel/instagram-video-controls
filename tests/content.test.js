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

function createStartFixture({ positionFor, beforeViewFactory, beforeControllerFactory } = {}) {
  FakeObserver.reset();
  const { body, document, html } = createDocumentTree();
  const discoveryCalls = [];
  const releasedVideos = [];
  const viewCalls = [];
  const controllerCalls = [];
  let discoveryStartCalls = 0;
  let discoveryStopCalls = 0;
  const discoveryFactory = (options) => {
    discoveryCalls.push(options);
    return {
      release(video) {
        releasedVideos.push(video);
      },
      start() {
        discoveryStartCalls += 1;
      },
      stop() {
        discoveryStopCalls += 1;
      },
    };
  };
  const viewFactory = (options) => {
    if (beforeViewFactory) {
      beforeViewFactory(options);
    }
    const view = {
      id: viewCalls.length + 1,
      destroyed: 0,
      destroy() {
        this.destroyed += 1;
      },
    };
    viewCalls.push({ options, view });
    return view;
  };
  const controllerFactory = (options) => {
    if (beforeControllerFactory) {
      beforeControllerFactory(options);
    }
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
    releasedVideos,
    viewCalls,
    window,
  };
}

function discover(fixture, video) {
  fixture.discoveryCalls[0].enhance(video);
}

test("findOverlayContainer chooses the outermost matching media layer above Instagram interaction overlays", () => {
  const { body, document } = createDocumentTree();
  const video = setRect(new FakeVideo(document), 320, 180);
  const matchingLayers = Array.from({ length: 8 }, () =>
    setRect(document.createElement("div"), 320, 180),
  );
  append(body, matchingLayers[7]);
  for (let index = 7; index > 0; index -= 1) {
    append(matchingLayers[index], matchingLayers[index - 1]);
  }
  append(matchingLayers[0], video);

  assert.equal(findOverlayContainer(video, createWindow()), matchingLayers[7]);
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

test("a shared container stays positioned until its final live video is cleaned up", () => {
  const fixture = createStartFixture({
    positionFor: (element) => element.style.position || "static",
  });
  const container = setRect(fixture.document.createElement("div"), 320, 180);
  const removedVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  const liveVideo = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, container);
  append(container, removedVideo);
  append(container, liveVideo);
  removedVideo.isConnected = true;
  liveVideo.isConnected = true;
  discover(fixture, removedVideo);
  discover(fixture, liveVideo);
  removedVideo.isConnected = false;

  FakeObserver.instances[0].emit([{ removedNodes: [removedVideo] }]);

  assert.equal(fixture.controllerCalls[0].controller.destroyed, 1);
  assert.equal(fixture.controllerCalls[1].controller.destroyed, 0);
  assert.equal(container.style.position, "relative");

  fixture.lifecycle.stop();

  assert.equal(fixture.controllerCalls[1].controller.destroyed, 1);
  assert.equal(container.style.position, undefined);
});

test("cleanup releases a detached video for one safe re-enhancement", () => {
  const fixture = createStartFixture();
  const container = setRect(fixture.document.createElement("div"), 320, 180);
  const video = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, container);
  append(container, video);
  video.isConnected = true;

  discover(fixture, video);
  discover(fixture, video);
  assert.equal(fixture.controllerCalls.length, 1);

  video.isConnected = false;
  FakeObserver.instances[0].emit([{ removedNodes: [video] }]);
  assert.deepEqual(fixture.releasedVideos, [video]);

  video.isConnected = true;
  discover(fixture, video);
  discover(fixture, video);
  assert.equal(fixture.controllerCalls.length, 2);
  fixture.lifecycle.stop();
});

test("a connected video moved into a new Reels container is rebound once", () => {
  const fixture = createStartFixture();
  const feedContainer = setRect(fixture.document.createElement("div"), 320, 180);
  const reelsContainer = setRect(fixture.document.createElement("div"), 320, 180);
  const video = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, feedContainer);
  append(fixture.body, reelsContainer);
  append(feedContainer, video);
  video.isConnected = true;

  discover(fixture, video);
  assert.equal(fixture.controllerCalls.length, 1);
  assert.equal(fixture.controllerCalls[0].options.container, feedContainer);

  video.remove();
  append(reelsContainer, video);
  video.isConnected = true;
  FakeObserver.instances[0].emit([{ addedNodes: [video], removedNodes: [video] }]);

  assert.equal(fixture.controllerCalls[0].controller.destroyed, 1);
  assert.equal(fixture.controllerCalls.length, 2);
  assert.equal(fixture.controllerCalls[1].options.container, reelsContainer);
  assert.deepEqual(fixture.releasedVideos, [video]);
  assert.equal(feedContainer.style.position, undefined);
  assert.equal(reelsContainer.style.position, "relative");
  fixture.lifecycle.stop();
});

test("a controller factory failure destroys the partial view, restores positioning, and permits retry", () => {
  let attempts = 0;
  const fixture = createStartFixture({
    beforeControllerFactory() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("controller construction failed");
      }
    },
  });
  const container = setRect(fixture.document.createElement("div"), 320, 180);
  const video = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, container);
  append(container, video);

  assert.throws(() => discover(fixture, video), /controller construction failed/);
  assert.equal(fixture.viewCalls[0].view.destroyed, 1);
  assert.equal(container.style.position, undefined);

  discover(fixture, video);
  assert.equal(fixture.viewCalls.length, 2);
  assert.equal(fixture.controllerCalls.length, 1);
  assert.equal(container.style.position, "relative");
  fixture.lifecycle.stop();
});

test("a view factory failure restores positioning and permits retry", () => {
  let attempts = 0;
  const fixture = createStartFixture({
    beforeViewFactory() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("view construction failed");
      }
    },
  });
  const container = setRect(fixture.document.createElement("div"), 320, 180);
  const video = setRect(new FakeVideo(fixture.document), 320, 180);
  append(fixture.body, container);
  append(container, video);

  assert.throws(() => discover(fixture, video), /view construction failed/);
  assert.equal(container.style.position, undefined);

  discover(fixture, video);
  assert.equal(fixture.viewCalls.length, 1);
  assert.equal(fixture.controllerCalls.length, 1);
  fixture.lifecycle.stop();
});
