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
    document,
    mute: root.querySelector("[data-igvc-mute]"),
    play: root.querySelector("[data-igvc-play]"),
    rate: root.querySelector("[data-igvc-rate]"),
    revealSurface: root.querySelector("[data-igvc-reveal-surface]"),
    seek: root.querySelector("[data-igvc-seek]"),
    style: root.querySelector("style"),
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

test("child control events do not escape to Instagram", () => {
  const { container, play, view } = createFixture();
  const receivedByInstagram = [];
  const isolatedEvents = ["pointerdown", "pointerup", "mousedown", "click", "dblclick", "keydown", "keyup"];
  for (const type of isolatedEvents) {
    container.addEventListener(type, (event) => receivedByInstagram.push(event.type));
  }

  for (const type of isolatedEvents) {
    const event = createEvent(type);
    play.dispatchEvent(event);
    assert.equal(event.propagationStopped, true);
    assert.equal(event.defaultPrevented, false);
  }

  assert.deepEqual(receivedByInstagram, []);
  view.destroy();
});

test("view styles reserve an interactive video overlay with responsive theme variables", () => {
  const { style, view } = createFixture();

  assert.match(style.textContent, /:host\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*display:\s*flex[^}]*align-items:\s*flex-end[^}]*width:\s*100%[^}]*height:\s*100%[^}]*z-index:/s);
  assert.match(style.textContent, /--igvc-accent:/);
  assert.match(style.textContent, /--igvc-panel-bg:/);
  assert.match(style.textContent, /@container\s*\(max-width:\s*430px\)/);
  assert.match(style.textContent, /\.igvc-panel\s*\{[^}]*grid-template-columns:[^}]*\}/s);
  assert.match(style.textContent, /@container\s*\(max-width:\s*430px\)\s*\{[^}]*grid-template-areas:\s*"seek seek seek seek time"\s*"play mute volume rate fullscreen"/s);
  assert.match(style.textContent, /visibility:\s*hidden/);
  assert.match(style.textContent, /pointer-events:\s*none/);
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

test("setState renders seek preview percentage while seeking", () => {
  const { seek, view } = createFixture();

  view.setState({ currentTime: 10, duration: 120, seeking: true, seekPercent: 75 });
  assert.equal(seek.value, "75");

  view.setState({ seeking: false });
  assert.equal(seek.value, "8.333333333333332");
  view.destroy();
});

test("container pointer movement shows the view and inactivity hides it when the timer fires", () => {
  const { container, document, timers, view } = createFixture();
  const instagramTarget = document.createElement("div");
  container.append(instagramTarget);

  instagramTarget.dispatchEvent(createEvent("pointermove"));
  assert.equal(container.children[0].classList.contains("igvc-visible"), true);

  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), false);
  view.destroy();
});

test("container movement reveals controls without replacing an underlying Instagram target", () => {
  const { container, controls, document, revealSurface, view } = createFixture();
  const instagramTarget = document.createElement("div");
  container.append(instagramTarget);
  let targetSeenByInstagram = null;
  container.addEventListener("pointermove", (event) => {
    targetSeenByInstagram = event.target;
  });

  assert.equal(revealSurface, null, "the view must not add a hit-testable reveal strip");
  assert.equal(controls.style.pointerEvents, "none");

  const movement = createEvent("pointermove");
  instagramTarget.dispatchEvent(movement);
  assert.equal(movement.target, instagramTarget);
  assert.equal(targetSeenByInstagram, instagramTarget);
  assert.equal(movement.propagationStopped, false);
  assert.equal(container.children[0].classList.contains("igvc-visible"), true);
  assert.equal(controls.style.pointerEvents, "auto");
  view.destroy();
});

test("container tap and click reveal controls without replacing the Instagram target", () => {
  const { container, document, timers, view } = createFixture();
  const instagramTarget = document.createElement("button");
  container.append(instagramTarget);
  const received = [];
  for (const type of ["pointerdown", "click"]) {
    container.addEventListener(type, (event) => received.push({ type, target: event.target }));
  }

  for (const type of ["pointerdown", "click"]) {
    const event = createEvent(type);
    instagramTarget.dispatchEvent(event);
    assert.equal(event.target, instagramTarget);
    assert.equal(event.propagationStopped, false);
    assert.equal(container.children[0].classList.contains("igvc-visible"), true);
    timers.fireAll();
  }

  assert.deepEqual(received, [
    { type: "pointerdown", target: instagramTarget },
    { type: "click", target: instagramTarget },
  ]);
  view.destroy();
});

test("keyboard focus reveals controls and prevents auto-hide until focus leaves", () => {
  const { container, play, timers, view } = createFixture();
  const host = container.children[0];

  assert.equal(host.getAttribute("tabindex"), "0");
  play.dispatchEvent(createEvent("focusin"));
  assert.equal(host.classList.contains("igvc-visible"), true);

  timers.fireAll();
  assert.equal(host.classList.contains("igvc-visible"), true);

  play.dispatchEvent(createEvent("focusout"));
  timers.fireAll();
  assert.equal(host.classList.contains("igvc-visible"), false);
  view.destroy();
});

test("keyboard events targeted at the focusable host do not escape to Instagram", () => {
  const { container, view } = createFixture();
  const host = container.children[0];
  const receivedByInstagram = [];
  for (const type of ["keydown", "keyup"]) {
    container.addEventListener(type, (event) => receivedByInstagram.push(event.type));
  }
  host.dispatchEvent(createEvent("focusin"));

  for (const type of ["keydown", "keyup"]) {
    const event = createEvent(type);
    host.dispatchEvent(event);
    assert.equal(event.propagationStopped, true);
    assert.equal(event.defaultPrevented, false);
  }

  assert.deepEqual(receivedByInstagram, []);
  view.destroy();
});

test("destroy removes every container reveal and host keyboard listener", () => {
  const { container, view } = createFixture();
  const host = container.children[0];

  for (const type of ["pointermove", "pointerdown", "click"]) {
    assert.equal(container.listenerCount(type), 1);
  }
  for (const type of ["keydown", "keyup"]) {
    assert.equal(host.listenerCount(type), 1);
  }
  view.destroy();
  for (const type of ["pointermove", "pointerdown", "click"]) {
    assert.equal(container.listenerCount(type), 0);
  }
  for (const type of ["keydown", "keyup"]) {
    assert.equal(host.listenerCount(type), 0);
  }
});

test("active range interaction keeps the view visible until the interaction ends", () => {
  const { container, document, seek, timers, view } = createFixture();
  const instagramTarget = document.createElement("div");
  container.append(instagramTarget);

  instagramTarget.dispatchEvent(createEvent("pointermove"));
  seek.dispatchEvent(createEvent("pointerdown"));
  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), true);

  seek.dispatchEvent(createEvent("change"));
  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), false);
  view.destroy();
});

test("active select interaction keeps the view visible until the selection commits", () => {
  const { container, document, rate, timers, view } = createFixture();
  const instagramTarget = document.createElement("div");
  container.append(instagramTarget);

  instagramTarget.dispatchEvent(createEvent("pointermove"));
  rate.dispatchEvent(createEvent("pointerdown"));
  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), true);

  rate.dispatchEvent(createEvent("change"));
  timers.fireAll();
  assert.equal(container.children[0].classList.contains("igvc-visible"), false);
  view.destroy();
});

test("button pointer interactions prevent an existing hide timer from hiding controls", () => {
  const { container, document, fullscreen, mute, play, timers, view } = createFixture();
  const instagramTarget = document.createElement("div");
  container.append(instagramTarget);

  instagramTarget.dispatchEvent(createEvent("pointermove"));
  for (const button of [play, mute, fullscreen]) {
    button.dispatchEvent(createEvent("pointerdown"));
    timers.fireAll();
    assert.equal(container.children[0].classList.contains("igvc-visible"), true);
    button.dispatchEvent(createEvent("pointerup"));
    timers.fireAll();
  }

  assert.equal(container.children[0].classList.contains("igvc-visible"), false);
  view.destroy();
});

test("play, mute, and fullscreen icons are distinct and play responds to paused state", () => {
  const { fullscreen, mute, play, view } = createFixture();
  const playPath = play.querySelector("path");
  const mutePath = mute.querySelector("path");
  const fullscreenPath = fullscreen.querySelector("path");
  const playIconWhilePaused = playPath.getAttribute("d");
  const muteIconWhileAudible = mutePath.getAttribute("d");
  const fullscreenIconWhileWindowed = fullscreenPath.getAttribute("d");

  assert.notEqual(playIconWhilePaused, mutePath.getAttribute("d"));
  assert.notEqual(playIconWhilePaused, fullscreenPath.getAttribute("d"));
  assert.notEqual(mutePath.getAttribute("d"), fullscreenPath.getAttribute("d"));

  view.setState({ paused: false, muted: true, fullscreen: true });
  assert.notEqual(playPath.getAttribute("d"), playIconWhilePaused);
  assert.notEqual(mutePath.getAttribute("d"), muteIconWhileAudible);
  assert.notEqual(fullscreenPath.getAttribute("d"), fullscreenIconWhileWindowed);
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

test("fullscreen capability disables the button only when no fullscreen operation is supported", () => {
  const { fullscreen, view } = createFixture();

  view.setState({ fullscreenAvailable: false });
  assert.equal(fullscreen.disabled, true);
  assert.equal(fullscreen.getAttribute("aria-disabled"), "true");

  view.setState({ fullscreenAvailable: true });
  assert.equal(fullscreen.disabled, false);
  assert.equal(fullscreen.getAttribute("aria-disabled"), "false");
  view.destroy();
});
