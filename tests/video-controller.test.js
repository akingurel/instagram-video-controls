const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/media-utils.js");
const { createVideoController } = require("../src/video-controller.js");
const { FakeDocument, FakeVideo, createEvent } = require("./helpers/fakes.js");

function createFixture(options = {}) {
  const document = new FakeDocument();
  const container = document.createElement("div");
  const video = new FakeVideo(document, { duration: 120, ...options.video });
  const view = {
    destroyCalls: 0,
    errors: [],
    states: [],
    setError(kind) {
      this.errors.push(kind);
    },
    setState(state) {
      this.lastState = state;
      this.states.push(state);
    },
    destroy() {
      this.destroyCalls += 1;
    },
  };
  const controller = createVideoController({ video, container, view, document });

  return { container, controller, document, video, view };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test("media events publish authoritative video state", () => {
  const { controller, video, view } = createFixture();

  video.currentTime = 30;
  video.volume = 0.4;
  video.playbackRate = 1.25;
  video.paused = false;
  video.dispatchEvent(createEvent("timeupdate"));
  assert.equal(view.lastState.currentTime, 30);
  video.dispatchEvent(createEvent("volumechange"));
  assert.equal(view.lastState.volume, 0.4);
  video.dispatchEvent(createEvent("ratechange"));
  assert.equal(view.lastState.playbackRate, 1.25);
  video.dispatchEvent(createEvent("play"));
  assert.equal(view.lastState.paused, false);

  controller.destroy();
});

test("duration events retain an unknown duration until video metadata is available", () => {
  const { controller, video, view } = createFixture({ video: { duration: Number.NaN } });

  video.dispatchEvent(createEvent("durationchange"));
  assert.equal(Number.isNaN(view.lastState.duration), true);
  video.duration = 90;
  video.dispatchEvent(createEvent("loadedmetadata"));
  assert.equal(view.lastState.duration, 90);

  controller.destroy();
});

test("seeking preview is not overwritten by timeupdate", async () => {
  const { controller, video, view } = createFixture();

  await controller.handleIntent({ type: "seek-start" });
  await controller.handleIntent({ type: "seek-preview", value: 75 });
  video.currentTime = 10;
  video.dispatchEvent(createEvent("timeupdate"));
  assert.equal(view.lastState.seekPercent, 75);
  await controller.handleIntent({ type: "seek-commit", value: 75 });
  assert.equal(video.currentTime, 90);
  assert.equal(view.lastState.seeking, false);

  controller.destroy();
});

test("toggle-play pauses an active video and keeps rejection paused", async () => {
  const { controller, video, view } = createFixture({ video: { paused: false } });

  await controller.handleIntent({ type: "toggle-play" });
  assert.equal(video.pauseCalls, 1);
  assert.equal(view.lastState.paused, true);

  video.playError = new Error("autoplay blocked");
  await controller.handleIntent({ type: "toggle-play" });
  assert.equal(video.playCalls, 1);
  assert.equal(view.lastState.paused, true);

  controller.destroy();
});

test("toggle-play successfully starts a paused video", async () => {
  const { controller, video, view } = createFixture();

  await controller.handleIntent({ type: "toggle-play" });

  assert.equal(video.playCalls, 1);
  assert.equal(video.paused, false);
  assert.equal(view.lastState.paused, false);
  controller.destroy();
});

test("a completed play operation does not publish after the controller is destroyed", async () => {
  const { controller, video, view } = createFixture();
  const deferred = createDeferred();
  video.play = () => deferred.promise;
  const intent = controller.handleIntent({ type: "toggle-play" });
  const statesBeforeDestroy = view.states.length;

  controller.destroy();
  deferred.resolve();
  await intent;

  assert.equal(view.states.length, statesBeforeDestroy);
});

test("mute and volume intents update the video with clamped volume", async () => {
  const { controller, video } = createFixture({ video: { muted: true } });

  await controller.handleIntent({ type: "toggle-mute" });
  assert.equal(video.muted, false);
  await controller.handleIntent({ type: "volume", value: 125 });
  assert.equal(video.volume, 1);
  assert.equal(video.muted, false);
  await controller.handleIntent({ type: "volume", value: -20 });
  assert.equal(video.volume, 0);

  controller.destroy();
});

test("a nonzero volume intent unmutes the video", async () => {
  const { controller, video } = createFixture({ video: { muted: true, volume: 0 } });

  await controller.handleIntent({ type: "volume", value: 35 });

  assert.equal(video.volume, 0.35);
  assert.equal(video.muted, false);
  controller.destroy();
});

test("rate intent assigns only a supported rate", async () => {
  const { controller, video } = createFixture();

  await controller.handleIntent({ type: "rate", value: 1.5 });
  assert.equal(video.playbackRate, 1.5);
  await controller.handleIntent({ type: "rate", value: 3 });
  assert.equal(video.playbackRate, 1.5);

  controller.destroy();
});

test("fullscreen falls back from container to video", async () => {
  const { container, controller, video } = createFixture();
  container.requestFullscreen = async () => { throw new Error("denied"); };
  video.requestFullscreen = async () => { video.fullscreenRequested = true; };

  await controller.handleIntent({ type: "fullscreen" });

  assert.equal(video.fullscreenRequested, true);
  controller.destroy();
});

test("fullscreen succeeds on the container without requesting the video", async () => {
  const { container, controller, video } = createFixture();
  let containerRequests = 0;
  let videoRequests = 0;
  container.requestFullscreen = async () => { containerRequests += 1; };
  video.requestFullscreen = async () => { videoRequests += 1; };

  await controller.handleIntent({ type: "fullscreen" });

  assert.equal(containerRequests, 1);
  assert.equal(videoRequests, 0);
  controller.destroy();
});

test("fullscreen reports an error when both request targets reject", async () => {
  const { container, controller, video, view } = createFixture();
  container.requestFullscreen = async () => { throw new Error("denied"); };
  video.requestFullscreen = async () => { throw new Error("denied"); };

  await controller.handleIntent({ type: "fullscreen" });

  assert.deepEqual(view.errors, ["fullscreen"]);
  controller.destroy();
});

test("a rejected fullscreen request does not fall back after the controller is destroyed", async () => {
  const { container, controller, video, view } = createFixture();
  const deferred = createDeferred();
  let videoRequests = 0;
  container.requestFullscreen = () => deferred.promise;
  video.requestFullscreen = async () => { videoRequests += 1; };
  const intent = controller.handleIntent({ type: "fullscreen" });

  controller.destroy();
  deferred.reject(new Error("denied"));
  await intent;

  assert.equal(videoRequests, 0);
  assert.deepEqual(view.errors, []);
});

test("a rejected fullscreen fallback does not report an error after destroy", async () => {
  const { container, controller, video, view } = createFixture();
  const deferred = createDeferred();
  container.requestFullscreen = async () => { throw new Error("denied"); };
  video.requestFullscreen = () => deferred.promise;
  const intent = controller.handleIntent({ type: "fullscreen" });
  await Promise.resolve();

  controller.destroy();
  deferred.reject(new Error("denied"));
  await intent;

  assert.deepEqual(view.errors, []);
});

test("fullscreenchange publishes fullscreen state and fullscreen intent exits", async () => {
  const { container, controller, document, view } = createFixture();
  let exits = 0;
  document.fullscreenElement = container;
  document.exitFullscreen = async () => { exits += 1; };
  document.dispatchEvent(createEvent("fullscreenchange"));
  assert.equal(view.lastState.fullscreen, true);

  await controller.handleIntent({ type: "fullscreen" });
  assert.equal(exits, 1);
  document.fullscreenElement = null;
  document.dispatchEvent(createEvent("fullscreenchange"));
  assert.equal(view.lastState.fullscreen, false);

  controller.destroy();
});

test("fullscreen layout fits vertical video and restores previous inline styles on exit", () => {
  const { container, controller, document, video } = createFixture();
  container.style.display = "grid";
  container.style.width = "640px";
  video.style.objectFit = "cover";

  document.fullscreenElement = container;
  document.dispatchEvent(createEvent("fullscreenchange"));

  assert.equal(container.style.width, "100vw");
  assert.equal(container.style.height, "100vh");
  assert.equal(container.style.overflow, "hidden");
  assert.equal(container.style.display, "grid");
  assert.equal(container.style.alignItems, undefined);
  assert.equal(container.style.justifyContent, undefined);
  assert.equal(container.style.background, "#000");
  assert.equal(video.style.position, "fixed");
  assert.equal(video.style.inset, "0");
  assert.equal(video.style.margin, "auto");
  assert.equal(video.style.width, "100vw");
  assert.equal(video.style.height, "100vh");
  assert.equal(video.style.maxWidth, "100vw");
  assert.equal(video.style.maxHeight, "100vh");
  assert.equal(video.style.objectFit, "contain");

  document.fullscreenElement = null;
  document.dispatchEvent(createEvent("fullscreenchange"));

  assert.equal(container.style.display, "grid");
  assert.equal(container.style.width, "640px");
  assert.equal(container.style.height, undefined);
  assert.equal(container.style.overflow, undefined);
  assert.equal(video.style.objectFit, "cover");
  assert.equal(video.style.position, undefined);
  assert.equal(video.style.inset, undefined);
  assert.equal(video.style.maxHeight, undefined);
  controller.destroy();
});

test("fullscreen layout restores previous inline styles when the controller is destroyed", () => {
  const { container, controller, document, video } = createFixture();
  container.style.display = "grid";
  video.style.objectFit = "cover";
  document.fullscreenElement = container;
  document.dispatchEvent(createEvent("fullscreenchange"));

  assert.equal(container.style.width, "100vw");
  assert.equal(video.style.objectFit, "contain");
  controller.destroy();

  assert.equal(container.style.display, "grid");
  assert.equal(container.style.width, undefined);
  assert.equal(container.style.height, undefined);
  assert.equal(video.style.objectFit, "cover");
  assert.equal(video.style.maxWidth, undefined);
  assert.equal(video.style.maxHeight, undefined);
});

test("destroy removes media and fullscreen listeners then destroys the view once", () => {
  const { controller, document, video, view } = createFixture();

  controller.destroy();
  controller.destroy();

  for (const type of ["play", "pause", "timeupdate", "durationchange", "loadedmetadata", "volumechange", "ratechange", "ended"]) {
    assert.equal(video.listenerCount(type), 0);
  }
  assert.equal(document.listenerCount("fullscreenchange"), 0);
  assert.equal(view.destroyCalls, 1);
});

test("published state represents fullscreen capability", () => {
  const document = new FakeDocument();
  const container = document.createElement("div");
  const video = new FakeVideo(document, { duration: 120 });
  container.requestFullscreen = () => Promise.resolve();
  const view = {
    setState(state) {
      this.lastState = state;
    },
    setError() {},
    destroy() {},
  };

  const controller = createVideoController({ video, container, view, document });
  assert.equal(view.lastState.fullscreenAvailable, true);

  delete container.requestFullscreen;
  video.dispatchEvent(createEvent("durationchange"));
  assert.equal(view.lastState.fullscreenAvailable, false);
  controller.destroy();
});
