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

test("fullscreen reports an error when both request targets reject", async () => {
  const { container, controller, video, view } = createFixture();
  container.requestFullscreen = async () => { throw new Error("denied"); };
  video.requestFullscreen = async () => { throw new Error("denied"); };

  await controller.handleIntent({ type: "fullscreen" });

  assert.deepEqual(view.errors, ["fullscreen"]);
  controller.destroy();
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
