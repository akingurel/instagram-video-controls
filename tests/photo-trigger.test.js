const test = require("node:test");
const assert = require("node:assert/strict");
const { createPhotoTrigger } = require("../src/photo-trigger.js");
const { FakeDocument, createEvent } = require("./helpers/fakes.js");

function createFixture() {
  const document = new FakeDocument();
  const container = document.createElement("div");
  const activations = [];
  const trigger = createPhotoTrigger({
    document,
    container,
    onOpen: () => activations.push("open"),
  });
  const root = trigger.host.shadowRoot;
  return {
    activations,
    button: root.querySelector("[data-igvc-photo-open]"),
    container,
    root,
    style: root.querySelector("style"),
    trigger,
  };
}

test("creates one isolated magnifier host in the supplied container", () => {
  const { button, container, root, style, trigger } = createFixture();

  assert.equal(container.children.length, 1);
  assert.equal(trigger.host.dataset.igvcPhotoTrigger, "");
  assert.equal(trigger.host.shadowRoot, root);
  assert.equal(button.getAttribute("aria-label"), "Fotoğrafı büyüt");
  assert.equal(button.querySelector("svg").namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(button.querySelector("path").namespaceURI, "http://www.w3.org/2000/svg");
  assert.match(style.textContent, /:host\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(style.textContent, /button\s*\{[^}]*position:\s*absolute[^}]*top:\s*12px[^}]*right:\s*12px/s);
  assert.match(style.textContent, /width:\s*32px[^}]*height:\s*32px/s);
  assert.match(style.textContent, /#60a5fa/i);
  assert.match(style.textContent, /background:\s*rgb\(12 12 16\s*\/\s*52%\)/);
  trigger.destroy();
});

test("container hover and keyboard focus reveal the trigger", () => {
  const { button, container, trigger } = createFixture();

  container.dispatchEvent(createEvent("pointerenter"));
  assert.equal(trigger.host.classList.contains("igvc-photo-trigger-visible"), true);

  container.dispatchEvent(createEvent("pointerleave"));
  assert.equal(trigger.host.classList.contains("igvc-photo-trigger-visible"), false);

  button.dispatchEvent(createEvent("focusin"));
  assert.equal(trigger.host.classList.contains("igvc-photo-trigger-visible"), true);

  button.dispatchEvent(createEvent("focusout"));
  assert.equal(trigger.host.classList.contains("igvc-photo-trigger-visible"), false);
  trigger.destroy();
});

test("click, Enter, and Space activate once and stay isolated from Instagram", () => {
  const { activations, button, container, trigger } = createFixture();
  const receivedByInstagram = [];
  for (const type of ["pointerdown", "click", "dblclick", "keydown", "keyup"]) {
    container.addEventListener(type, (event) => receivedByInstagram.push(event.type));
  }

  const pointerdown = createEvent("pointerdown");
  button.dispatchEvent(pointerdown);
  const click = createEvent("click");
  button.dispatchEvent(click);
  const enter = createEvent("keydown", { key: "Enter" });
  button.dispatchEvent(enter);
  const space = createEvent("keydown", { key: " " });
  button.dispatchEvent(space);
  const ignoredKey = createEvent("keydown", { key: "ArrowRight" });
  button.dispatchEvent(ignoredKey);

  assert.deepEqual(activations, ["open", "open", "open"]);
  assert.deepEqual(receivedByInstagram, []);
  assert.equal(pointerdown.propagationStopped, true);
  assert.equal(click.defaultPrevented, true);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(space.defaultPrevented, true);
  assert.equal(ignoredKey.defaultPrevented, false);
  trigger.destroy();
});

test("focus delegates to the button and destroy removes host and listeners", () => {
  const { button, container, trigger } = createFixture();

  trigger.focus();
  assert.equal(button.ownerDocument.activeElement, button);
  assert.equal(container.listenerCount("pointerenter"), 1);
  assert.equal(container.listenerCount("pointerleave"), 1);

  trigger.destroy();
  trigger.destroy();

  assert.equal(container.children.length, 0);
  assert.equal(container.listenerCount("pointerenter"), 0);
  assert.equal(container.listenerCount("pointerleave"), 0);
});
