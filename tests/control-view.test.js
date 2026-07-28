const test = require("node:test");
const assert = require("node:assert/strict");
const { ALLOWED_RATES } = require("../src/media-utils.js");
const { createControlView } = require("../src/control-view.js");
const { FakeDocument, FakeTimers, createEvent } = require("./helpers/fakes.js");

function createFixture() {
  const document = new FakeDocument();
  const container = document.createElement("div");
  const timers = new FakeTimers();
  const intents = [];
  const view = createControlView({
    document,
    container,
    rates: ALLOWED_RATES,
    onIntent: (intent) => intents.push(intent),
    setTimeout: timers.setTimeout.bind(timers),
    clearTimeout: timers.clearTimeout.bind(timers),
  });
  const root = container.children[0].shadowRoot;

  return {
    container,
    controls: root.querySelector("[data-igvc-panel]"),
    fullscreen: root.querySelector("[data-igvc-fullscreen]"),
    mute: root.querySelector("[data-igvc-mute]"),
    play: root.querySelector("[data-igvc-play]"),
    rate: root.querySelector("[data-igvc-rate]"),
    seek: root.querySelector("[data-igvc-seek]"),
    time: root.querySelector("[data-igvc-time]"),
    timers,
    intents,
    view,
    volume: root.querySelector("[data-igvc-volume]"),
  };
}

test("creates one namespaced shadow host in the supplied container", () => {
  const { container, view } = createFixture();

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].dataset.igvcHost, "");
  assert.ok(container.children[0].shadowRoot);
  view.destroy();
  assert.equal(container.children.length, 0);
});

test("control pointer and click events do not escape to Instagram", () => {
  const { controls, view } = createFixture();
  const pointerEvent = createEvent("pointerdown");
  const clickEvent = createEvent("click");

  controls.dispatchEvent(pointerEvent);
  controls.dispatchEvent(clickEvent);

  assert.equal(pointerEvent.propagationStopped, true);
  assert.equal(clickEvent.propagationStopped, true);
  view.destroy();
});

test("setState renders time, seek, volume, rate, and disabled duration", () => {
  const { rate, seek, time, view, volume } = createFixture();

  view.setState({
    paused: false,
    currentTime: 65,
    duration: 120,
    volume: 0.4,
    muted: false,
    playbackRate: 1.25,
    seeking: false,
    fullscreen: false,
  });

  assert.equal(time.textContent, "1:05 / 2:00");
  assert.equal(seek.value, "54.166666666666664");
  assert.equal(volume.value, "40");
  assert.equal(rate.value, "1.25");
  assert.equal(seek.disabled, false);

  view.setState({ duration: Number.NaN });
  assert.equal(seek.disabled, true);
  view.destroy();
});

test("pointer entry shows the view and inactive controls hide when the timer fires", () => {
  const { container, controls, timers, view } = createFixture();

  controls.dispatchEvent(createEvent("pointerenter"));
  assert.equal(container.children[0].classList.contains("igvc-visible"), true);

  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), false);
  view.destroy();
});

test("active range interaction keeps the view visible until the interaction ends", () => {
  const { container, controls, seek, timers, view } = createFixture();

  controls.dispatchEvent(createEvent("pointerenter"));
  seek.dispatchEvent(createEvent("pointerdown"));
  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), true);

  seek.dispatchEvent(createEvent("change"));
  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), false);
  view.destroy();
});

test("controls emit media intents without preventing range defaults", () => {
  const { fullscreen, intents, mute, play, rate, seek, view, volume } = createFixture();
  seek.value = "25";
  volume.value = "40";
  rate.value = "1.25";
  const seekInput = createEvent("input");

  play.dispatchEvent(createEvent("click"));
  seek.dispatchEvent(createEvent("pointerdown"));
  seek.dispatchEvent(seekInput);
  seek.dispatchEvent(createEvent("change"));
  mute.dispatchEvent(createEvent("click"));
  volume.dispatchEvent(createEvent("input"));
  rate.dispatchEvent(createEvent("change"));
  fullscreen.dispatchEvent(createEvent("click"));

  assert.equal(seekInput.defaultPrevented, false);
  assert.deepEqual(intents, [
    { type: "toggle-play" },
    { type: "seek-start" },
    { type: "seek-preview", value: 25 },
    { type: "seek-commit", value: 25 },
    { type: "toggle-mute" },
    { type: "volume", value: 40 },
    { type: "rate", value: 1.25 },
    { type: "fullscreen" },
  ]);
  view.destroy();
});
