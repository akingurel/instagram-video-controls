const test = require("node:test");
const assert = require("node:assert/strict");
const { createPhotoViewer } = require("../src/photo-viewer.js");
const { FakeDocument, createEvent } = require("./helpers/fakes.js");

function createDocumentTree() {
  const document = new FakeDocument();
  const html = document.createElement("html");
  const body = document.createElement("body");
  document.documentElement = html;
  document.append(html);
  html.append(body);
  document.body = body;
  return document;
}

function createFixture() {
  const document = createDocumentTree();
  const viewer = createPhotoViewer({ document });
  const host = document.documentElement.children[1];
  const root = host.shadowRoot;
  const intents = [];
  viewer.setIntentHandler((intent) => intents.push(intent));
  return {
    backdrop: root.querySelector("[data-igvc-photo-backdrop]"),
    close: root.querySelector("[data-igvc-photo-close]"),
    document,
    error: root.querySelector("[data-igvc-photo-error]"),
    host,
    image: root.querySelector("[data-igvc-photo-image]"),
    intents,
    next: root.querySelector("[data-igvc-photo-next]"),
    previous: root.querySelector("[data-igvc-photo-previous]"),
    ratio: root.querySelector("[data-igvc-photo-ratio]"),
    reset: root.querySelector("[data-igvc-photo-reset]"),
    root,
    spinner: root.querySelector("[data-igvc-photo-loading]"),
    stage: root.querySelector("[data-igvc-photo-stage]"),
    style: root.querySelector("style"),
    viewer,
    zoomIn: root.querySelector("[data-igvc-photo-zoom-in]"),
    zoomOut: root.querySelector("[data-igvc-photo-zoom-out]"),
  };
}

test("creates toolbar buttons without adding an empty class token", () => {
  const document = createDocumentTree();

  assert.doesNotThrow(() => createPhotoViewer({ document }));
});

test("creates one fixed accessible viewer above Instagram", () => {
  const { backdrop, close, host, image, style, viewer } = createFixture();

  assert.equal(host.dataset.igvcPhotoViewer, "");
  assert.equal(host.hidden, true);
  assert.match(style.textContent, /:host\(\[hidden\]\)\s*\{[^}]*display:\s*none/s);
  assert.equal(backdrop.getAttribute("role"), "dialog");
  assert.equal(backdrop.getAttribute("aria-modal"), "true");
  assert.equal(backdrop.getAttribute("aria-label"), "Fotoğraf görüntüleyici");
  assert.equal(close.getAttribute("aria-label"), "Kapat");
  assert.equal(image.getAttribute("draggable"), "false");
  assert.match(style.textContent, /:host\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*2147483647/s);
  assert.match(style.textContent, /background:\s*rgb\(0 0 0\s*\/\s*88%\)/);
  assert.match(style.textContent, /#60a5fa/i);
  assert.match(style.textContent, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  viewer.destroy();
});

test("open locks scrolling, sets content, and focuses close", () => {
  const fixture = createFixture();
  const returnFocus = fixture.document.createElement("button");
  let restoredFocus = 0;
  returnFocus.focus = () => {
    restoredFocus += 1;
  };
  fixture.document.documentElement.style.overflow = "clip";
  fixture.document.body.style.overflow = "auto";

  fixture.viewer.open({
    alt: "Dağ manzarası",
    hasNext: true,
    hasPrevious: false,
    returnFocus,
    src: "photo-large.jpg",
  });

  assert.equal(fixture.host.hidden, false);
  assert.equal(fixture.image.src, "photo-large.jpg");
  assert.equal(fixture.image.alt, "Dağ manzarası");
  assert.equal(fixture.document.documentElement.style.overflow, "hidden");
  assert.equal(fixture.document.body.style.overflow, "hidden");
  assert.equal(fixture.document.activeElement, fixture.close);
  assert.equal(fixture.previous.disabled, true);
  assert.equal(fixture.next.disabled, false);

  fixture.viewer.close();

  assert.equal(fixture.host.hidden, true);
  assert.equal(fixture.document.documentElement.style.overflow, "clip");
  assert.equal(fixture.document.body.style.overflow, "auto");
  assert.equal(restoredFocus, 1);
  fixture.viewer.destroy();
});

test("setState renders transform, ratio, navigation, loading, and error", () => {
  const fixture = createFixture();
  fixture.viewer.open({ src: "photo.jpg", alt: "", returnFocus: null });

  fixture.viewer.setState({
    error: "",
    hasNext: false,
    hasPrevious: true,
    loading: true,
    scale: 2.35,
    x: 20,
    y: -10,
  });

  assert.equal(fixture.image.style.transform, "translate3d(20px, -10px, 0) scale(2.35)");
  assert.equal(fixture.ratio.textContent, "2.35×");
  assert.equal(fixture.spinner.hidden, false);
  assert.equal(fixture.error.hidden, true);
  assert.equal(fixture.previous.disabled, false);
  assert.equal(fixture.next.disabled, true);

  fixture.viewer.setState({ error: "Fotoğraf yüklenemedi.", loading: false });
  assert.equal(fixture.spinner.hidden, true);
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.error.textContent, "Fotoğraf yüklenemedi.");
  fixture.viewer.destroy();
});

test("controls and blank backdrop emit intents without accidental close", () => {
  const fixture = createFixture();
  fixture.viewer.open({ src: "photo.jpg", alt: "", returnFocus: null });

  fixture.zoomIn.dispatchEvent(createEvent("click"));
  fixture.zoomOut.dispatchEvent(createEvent("click"));
  fixture.reset.dispatchEvent(createEvent("click"));
  fixture.previous.disabled = false;
  fixture.next.disabled = false;
  fixture.previous.dispatchEvent(createEvent("click"));
  fixture.next.dispatchEvent(createEvent("click"));
  fixture.image.dispatchEvent(createEvent("click"));
  fixture.backdrop.dispatchEvent(createEvent("click"));
  fixture.close.dispatchEvent(createEvent("click"));

  assert.deepEqual(fixture.intents.map(({ type }) => type), [
    "zoom-in",
    "zoom-out",
    "reset",
    "previous",
    "next",
    "close",
    "close",
  ]);
  fixture.viewer.destroy();
});

test("stage emits normalized wheel and pointer intents with pointer capture", () => {
  const fixture = createFixture();
  fixture.viewer.open({ src: "photo.jpg", alt: "", returnFocus: null });

  const wheel = createEvent("wheel", { clientX: 320, clientY: 210, deltaY: -120 });
  fixture.stage.dispatchEvent(wheel);
  fixture.stage.dispatchEvent(createEvent("pointerdown", {
    clientX: 100,
    clientY: 120,
    pointerId: 7,
  }));
  fixture.stage.dispatchEvent(createEvent("pointermove", {
    clientX: 130,
    clientY: 150,
    pointerId: 7,
  }));
  fixture.stage.dispatchEvent(createEvent("pointerup", {
    clientX: 130,
    clientY: 150,
    pointerId: 7,
  }));
  fixture.image.dispatchEvent(createEvent("load"));
  fixture.image.dispatchEvent(createEvent("error"));

  assert.equal(wheel.defaultPrevented, true);
  assert.equal(fixture.stage.hasPointerCapture(7), false);
  assert.deepEqual(fixture.intents, [
    { type: "wheel", clientX: 320, clientY: 210, deltaY: -120 },
    { type: "pointer-down", clientX: 100, clientY: 120, pointerId: 7 },
    { type: "pointer-move", clientX: 130, clientY: 150, pointerId: 7 },
    { type: "pointer-up", clientX: 130, clientY: 150, pointerId: 7 },
    { type: "image-load" },
    { type: "image-error" },
  ]);
  fixture.viewer.destroy();
});

test("keyboard shortcuts emit intents and trap Tab focus inside the viewer", () => {
  const fixture = createFixture();
  fixture.viewer.open({ src: "photo.jpg", alt: "", hasNext: true, hasPrevious: true });

  for (const [key, type] of [
    ["Escape", "close"],
    ["ArrowLeft", "previous"],
    ["ArrowRight", "next"],
    ["+", "zoom-in"],
    ["-", "zoom-out"],
    ["0", "reset"],
  ]) {
    const event = createEvent("keydown", { key });
    fixture.backdrop.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(fixture.intents.at(-1).type, type);
  }

  fixture.reset.focus();
  fixture.backdrop.dispatchEvent(createEvent("keydown", { key: "Tab" }));
  assert.equal(fixture.document.activeElement, fixture.close);

  fixture.close.focus();
  fixture.backdrop.dispatchEvent(createEvent("keydown", { key: "Tab", shiftKey: true }));
  assert.equal(fixture.document.activeElement, fixture.reset);
  fixture.viewer.destroy();
});

test("exposes stage and image rectangles and destroy restores an open viewer", () => {
  const fixture = createFixture();
  fixture.stage.getBoundingClientRect = () => ({
    width: 900, height: 650, left: 20, top: 30,
  });
  fixture.image.getBoundingClientRect = () => ({
    width: 700, height: 500, left: 120, top: 90,
  });
  fixture.document.documentElement.style.overflow = "visible";
  fixture.document.body.style.overflow = "scroll";
  fixture.viewer.open({ src: "photo.jpg", alt: "", returnFocus: null });

  assert.deepEqual(fixture.viewer.getViewportRect(), {
    width: 900, height: 650, left: 20, top: 30,
  });
  assert.deepEqual(fixture.viewer.getImageRect(), {
    width: 700, height: 500, left: 120, top: 90,
  });

  fixture.viewer.destroy();
  assert.equal(fixture.document.documentElement.style.overflow, "visible");
  assert.equal(fixture.document.body.style.overflow, "scroll");
  assert.equal(fixture.host.parentNode, null);
});
