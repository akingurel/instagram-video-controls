# Compact Instagram Video Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized opaque Instagram overlay with compact translucent controls, valid SVG icons, an on-demand volume slider, and viewport-safe fullscreen video fitting.

**Architecture:** Keep the existing Shadow DOM view and intent contract. `control-view.js` owns compact rendering and interaction presentation; `video-controller.js` owns temporary fullscreen layout overrides and exact restoration. Test helpers gain namespace tracking so icon construction can be verified without a browser.

**Tech Stack:** Chrome Manifest V3 content scripts, plain JavaScript, Shadow DOM, CSS container queries, Fullscreen API, Node.js built-in test runner.

## Global Constraints

- Preserve all existing media intent names and behavior.
- The panel must use roughly half of its current vertical space and an approximately 45% dark translucent background.
- The volume slider appears only while the volume area is hovered or focused.
- Vertical video must use `object-fit: contain` in container fullscreen.
- Every temporary fullscreen inline style must be restored on exit and destroy.
- Do not add runtime dependencies.

---

### Task 1: Valid SVG Icons

**Files:**
- Modify: `tests/helpers/fakes.js`
- Modify: `tests/control-view.test.js`
- Modify: `src/control-view.js`

**Interfaces:**
- Consumes: `createControlView({ document, container, rates, onIntent, setTimeout, clearTimeout })`
- Produces: `svgElement.namespaceURI === "http://www.w3.org/2000/svg"` for every icon.

- [ ] **Step 1: Add namespace support to the fake DOM and write the failing icon test**

Add this method to `FakeDocument`:

```js
createElementNS(namespaceURI, tagName) {
  const element = new FakeElement(tagName, this);
  element.namespaceURI = namespaceURI;
  return element;
}
```

Extend the existing icon test:

```js
const svgNamespace = "http://www.w3.org/2000/svg";
assert.equal(play.querySelector("svg").namespaceURI, svgNamespace);
assert.equal(mute.querySelector("svg").namespaceURI, svgNamespace);
assert.equal(fullscreen.querySelector("svg").namespaceURI, svgNamespace);
assert.equal(play.querySelector("path").namespaceURI, svgNamespace);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --test-name-pattern="play, mute, and fullscreen icons" tests/control-view.test.js
```

Expected: FAIL because the current `iconButton` uses HTML `createElement`.

- [ ] **Step 3: Create SVG nodes with the SVG namespace**

In `src/control-view.js`, add:

```js
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function svgElement(document, tagName, attributes = {}) {
  const node = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}
```

Update `iconButton` to create both `svg` and `path` through `svgElement`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="play, mute, and fullscreen icons" tests/control-view.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add tests/helpers/fakes.js tests/control-view.test.js src/control-view.js
git commit -m "fix: render video controls with valid svg icons"
```

---

### Task 2: Compact Glass Panel and On-Demand Volume

**Files:**
- Modify: `tests/control-view.test.js`
- Modify: `src/control-view.js`

**Interfaces:**
- Consumes: existing view controls and `setState`.
- Produces: a `.igvc-volume-control` wrapper containing `[data-igvc-mute]` and `[data-igvc-volume]`.

- [ ] **Step 1: Write failing structure and styling tests**

Expose the volume wrapper in `createFixture`:

```js
volumeControl: root.querySelector("[data-igvc-volume-control]"),
```

Replace the broad responsive style assertions with exact product contracts:

```js
assert.match(style.textContent, /--igvc-panel-bg:\s*rgb\(12 12 16\s*\/\s*45%\)/);
assert.match(style.textContent, /\.igvc-panel\s*\{[^}]*padding:\s*6px[^}]*gap:\s*4px/s);
assert.match(style.textContent, /grid-template-areas:\s*"seek seek seek seek seek"\s*"play time volume rate fullscreen"/);
assert.match(style.textContent, /\[data-igvc-seek\]\s*\{[^}]*min-height:\s*14px/s);
assert.match(style.textContent, /button\s*\{[^}]*width:\s*30px[^}]*min-height:\s*30px/s);
assert.match(style.textContent, /\.igvc-volume-control:hover\s+\[data-igvc-volume\]/);
assert.match(style.textContent, /\.igvc-volume-control:focus-within\s+\[data-igvc-volume\]/);
assert.ok(volumeControl);
assert.equal(volumeControl.children[0], mute);
assert.equal(volumeControl.children[1], volume);
```

- [ ] **Step 2: Run the focused style test and verify RED**

Run:

```powershell
node --test --test-name-pattern="responsive theme variables" tests/control-view.test.js
```

Expected: FAIL because the panel is still opaque, padded by 10px, and has no volume wrapper.

- [ ] **Step 3: Implement the compact two-row panel**

Use one grid at every width:

```css
.igvc-panel {
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  grid-template-areas:
    "seek seek seek seek seek"
    "play time volume rate fullscreen";
  gap: 4px;
  width: calc(100% - 10px);
  margin: 5px;
  margin-bottom: max(5px, env(safe-area-inset-bottom));
  padding: 6px;
  background: rgb(12 12 16 / 45%);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 9px;
}
```

Set the seek row to `min-height: 14px`, buttons/select to `30px`, icons to `17px`, and default button backgrounds to transparent.

- [ ] **Step 4: Wrap mute and volume and implement the popover**

Create:

```js
const volumeControl = element(document, "div", { "data-igvc-volume-control": "" });
volumeControl.classList.add("igvc-volume-control");
volumeControl.append(mute, volume);
panel.append(play, seek, time, volumeControl, rate, fullscreen, error);
```

Style `[data-igvc-volume]` as an absolutely positioned 96px popover above the bottom row. Default it to `opacity: 0; visibility: hidden; pointer-events: none`; reveal it from `.igvc-volume-control:hover` and `.igvc-volume-control:focus-within`.

- [ ] **Step 5: Run all view tests and verify GREEN**

Run:

```powershell
node --test tests/control-view.test.js
```

Expected: all view tests PASS, including unchanged intent and auto-hide tests.

- [ ] **Step 6: Commit**

```powershell
git add tests/control-view.test.js src/control-view.js
git commit -m "feat: compact the Instagram video control bar"
```

---

### Task 3: Viewport-Safe Fullscreen Fitting

**Files:**
- Modify: `tests/video-controller.test.js`
- Modify: `src/video-controller.js`

**Interfaces:**
- Consumes: `document.fullscreenElement`, `container`, and `video`.
- Produces: internal `syncFullscreenLayout()` called on every `fullscreenchange`; no public API change.

- [ ] **Step 1: Write failing fullscreen application and restoration tests**

Add a test that sets pre-existing values, enters container fullscreen, and asserts:

```js
container.style.display = "grid";
container.style.width = "640px";
video.style.objectFit = "cover";
document.fullscreenElement = container;
document.dispatchEvent(createEvent("fullscreenchange"));

assert.equal(container.style.width, "100vw");
assert.equal(container.style.height, "100vh");
assert.equal(container.style.overflow, "hidden");
assert.equal(container.style.display, "flex");
assert.equal(video.style.width, "100%");
assert.equal(video.style.height, "100%");
assert.equal(video.style.maxWidth, "100vw");
assert.equal(video.style.maxHeight, "100vh");
assert.equal(video.style.objectFit, "contain");
```

Then exit and assert exact restoration:

```js
document.fullscreenElement = null;
document.dispatchEvent(createEvent("fullscreenchange"));
assert.equal(container.style.display, "grid");
assert.equal(container.style.width, "640px");
assert.equal(container.style.height, undefined);
assert.equal(video.style.objectFit, "cover");
assert.equal(video.style.maxHeight, undefined);
```

Add a second test that enters container fullscreen, calls `controller.destroy()`, and verifies the same restoration.

- [ ] **Step 2: Run the focused fullscreen tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="fullscreen layout" tests/video-controller.test.js
```

Expected: FAIL because no fullscreen fitting styles exist.

- [ ] **Step 3: Implement reversible fullscreen styles**

Define the exact property lists:

```js
const CONTAINER_FULLSCREEN_STYLES = {
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#000",
};
const VIDEO_FULLSCREEN_STYLES = {
  width: "100%",
  height: "100%",
  maxWidth: "100vw",
  maxHeight: "100vh",
  objectFit: "contain",
};
```

Inside `createVideoController`, snapshot each listed property immediately before the first application. `syncFullscreenLayout()` applies only when `document.fullscreenElement === container`; otherwise it restores and clears the snapshot. The `fullscreenchange` listener must call `syncFullscreenLayout()` before `publishState()`. `destroy()` must restore before removing listeners.

- [ ] **Step 4: Run controller tests and verify GREEN**

Run:

```powershell
node --test tests/video-controller.test.js
```

Expected: all controller tests PASS, including fallback, rejection, and destroy behavior.

- [ ] **Step 5: Commit**

```powershell
git add tests/video-controller.test.js src/video-controller.js
git commit -m "fix: fit vertical videos inside fullscreen"
```

---

### Task 4: Regression and Live Instagram Verification

**Files:**
- Verify: `src/control-view.js`
- Verify: `src/video-controller.js`
- Verify: `tests/*.test.js`
- Update if needed: `docs/manual-test-checklist.md`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: a tested extension branch ready to fast-forward into `master`.

- [ ] **Step 1: Run syntax and full automated checks**

Run:

```powershell
node --check src/control-view.js
node --check src/video-controller.js
npm.cmd test
git diff --check
```

Expected: syntax checks exit 0, all tests PASS, and `git diff --check` reports no errors.

- [ ] **Step 2: Reload the unpacked extension and Instagram**

In `chrome://extensions`, press **Reload** on “Instagram Video Controls”, then reload an Instagram post, Reel, or Story containing a video.

- [ ] **Step 3: Verify the compact panel on a narrow video**

Confirm:

- All five icon/control groups are visible.
- The panel uses two thin rows and does not cover captions unnecessarily.
- The video remains visible through the translucent background.
- The volume range is hidden at rest and appears on volume hover/focus.
- Seeking changes `video.currentTime`.

- [ ] **Step 4: Verify vertical fullscreen**

Enter fullscreen and confirm:

- The entire vertical frame is visible with its aspect ratio intact.
- No video content is clipped above or below the viewport.
- The control panel stays reachable at the lower safe edge.
- Exiting fullscreen returns the Instagram page to its original layout.

- [ ] **Step 5: Commit any checklist clarification**

If the checklist required clarification:

```powershell
git add docs/manual-test-checklist.md
git commit -m "docs: update compact controls verification"
```

- [ ] **Step 6: Fast-forward the verified branch**

```powershell
git switch master
git merge --ff-only feat/compact-video-controls
```
