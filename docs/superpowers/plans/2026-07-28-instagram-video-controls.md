# Instagram Video Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an unpacked Chrome Manifest V3 extension that adds modern media controls to Instagram post, Reel, and Story videos.

**Architecture:** Ordered content scripts expose a small `globalThis.IGVC` namespace inside Chrome's isolated world. Pure media helpers, incremental video discovery, a per-video controller, and a Shadow DOM view remain separate and testable; `content.js` only composes them and starts the observer.

**Tech Stack:** Chrome Manifest V3, dependency-free JavaScript, Shadow DOM, Fullscreen API, MutationObserver, Node.js built-in `node:test`.

## Global Constraints

- Run only on `https://www.instagram.com/*`.
- Provide play/pause, seeking, elapsed/total time, volume, mute, `0.5x`, `0.75x`, `1x`, `1.25x`, `1.5x`, `2x`, and fullscreen.
- Support posts, Reels, Stories, and Instagram single-page navigation.
- Do not use remote code, network requests, analytics, tracking, or persistent storage.
- Do not request permissions beyond the Instagram content-script match.
- Keep controls visible during pointer interaction and prevent control events from advancing Stories.
- Use no production or test dependencies.

---

## File Map

- `manifest.json`: Chrome Manifest V3 metadata and ordered Instagram content scripts.
- `package.json`: Local test command only; no dependencies.
- `src/media-utils.js`: Time formatting, clamping, seek conversion, and allowed playback rates.
- `src/video-discovery.js`: Initial and incremental video discovery with duplicate protection.
- `src/control-view.js`: Shadow DOM markup, styles, view updates, and user-intent callbacks.
- `src/video-controller.js`: Synchronizes one video element with one control view.
- `src/content.js`: Finds overlay containers, composes controllers, and starts observation.
- `tests/helpers/fakes.js`: Minimal event, media, node, and document fakes used by tests.
- `tests/media-utils.test.js`: Pure helper behavior.
- `tests/video-discovery.test.js`: Initial, incremental, and duplicate discovery behavior.
- `tests/control-view.test.js`: Shadow host creation, event isolation, and responsive control content.
- `tests/video-controller.test.js`: Media synchronization, seeking, volume, speed, and fullscreen fallback.
- `README.md`: Turkish installation and manual verification instructions.

---

### Task 1: Manifest and Media Utilities

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `src/media-utils.js`
- Create: `tests/media-utils.test.js`

**Interfaces:**
- Produces: `IGVC.media.ALLOWED_RATES: readonly number[]`
- Produces: `IGVC.media.formatTime(seconds: number): string`
- Produces: `IGVC.media.clamp(value: number, min: number, max: number): number`
- Produces: `IGVC.media.seekTime(percent: number, duration: number): number`

- [ ] **Step 1: Write the failing utility tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const media = require("../src/media-utils.js");

test("formatTime formats minutes and hours", () => {
  assert.equal(media.formatTime(65), "1:05");
  assert.equal(media.formatTime(3661), "1:01:01");
});

test("formatTime rejects unknown duration", () => {
  assert.equal(media.formatTime(Number.NaN), "--:--");
  assert.equal(media.formatTime(Number.POSITIVE_INFINITY), "--:--");
});

test("seekTime clamps the requested percentage", () => {
  assert.equal(media.seekTime(25, 200), 50);
  assert.equal(media.seekTime(125, 200), 200);
  assert.equal(media.seekTime(-10, 200), 0);
});

test("allowed playback rates match the product design", () => {
  assert.deepEqual(media.ALLOWED_RATES, [0.5, 0.75, 1, 1.25, 1.5, 2]);
});
```

- [ ] **Step 2: Run the utility tests and verify RED**

Run: `node --test tests/media-utils.test.js`

Expected: FAIL because `src/media-utils.js` does not exist.

- [ ] **Step 3: Implement the utilities and extension metadata**

Implement `src/media-utils.js` as an IIFE that assigns the four exports to `globalThis.IGVC.media` and also assigns `module.exports` when CommonJS exists. `formatTime` must floor non-negative seconds, use `M:SS` below one hour, and `H:MM:SS` at one hour or more. `seekTime` returns `0` when duration is not finite or not positive.

Create `manifest.json` with:

```json
{
  "manifest_version": 3,
  "name": "Instagram Video Controls",
  "version": "1.0.0",
  "description": "Instagram gönderileri, Reels ve Hikâyeler için modern video kontrolleri.",
  "content_scripts": [{
    "matches": ["https://www.instagram.com/*"],
    "js": [
      "src/media-utils.js",
      "src/video-discovery.js",
      "src/control-view.js",
      "src/video-controller.js",
      "src/content.js"
    ],
    "run_at": "document_idle"
  }]
}
```

Create `package.json` with `"private": true` and `"test": "node --test tests/*.test.js"`.

- [ ] **Step 4: Run tests and validate the manifest**

Run: `npm test`

Expected: 4 passing tests.

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"`

Expected: `manifest ok`.

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json src/media-utils.js tests/media-utils.test.js
git commit -m "feat: add extension manifest and media utilities"
```

---

### Task 2: Incremental Video Discovery

**Files:**
- Create: `src/video-discovery.js`
- Create: `tests/helpers/fakes.js`
- Create: `tests/video-discovery.test.js`

**Interfaces:**
- Produces: `IGVC.discovery.createVideoDiscovery({ root, MutationObserverClass, enhance }): { start(): void, stop(): void }`
- `root` supplies `querySelectorAll("video")`.
- Added nodes may supply `matches("video")` and `querySelectorAll("video")`.
- `enhance(video)` is called once per video object.

- [ ] **Step 1: Write failing discovery tests**

Create small fake nodes whose `querySelectorAll` returns configured child videos and a fake observer that stores its callback. Tests must assert:

```js
test("start enhances every existing video once", () => {
  const discovery = createVideoDiscovery({ root, MutationObserverClass: FakeObserver, enhance });
  discovery.start();
  discovery.start();
  assert.deepEqual(enhanced, [videoA, videoB]);
});

test("observer scans only added subtrees and ignores duplicates", () => {
  discovery.start();
  observer.emit([{ addedNodes: [subtreeContainingAAndC] }]);
  assert.deepEqual(enhanced, [videoA, videoB, videoC]);
});

test("stop disconnects the observer", () => {
  discovery.start();
  discovery.stop();
  assert.equal(observer.disconnected, true);
});
```

- [ ] **Step 2: Run discovery tests and verify RED**

Run: `node --test tests/video-discovery.test.js`

Expected: FAIL because `src/video-discovery.js` does not exist.

- [ ] **Step 3: Implement discovery**

Use a private `WeakSet` for enhanced videos. `start()` scans `root.querySelectorAll("video")` once, then observes `{ childList: true, subtree: true }`. For every added node, process the node itself when it matches `video`, then process only that node's descendant videos. Catch an exception from one `enhance` call so remaining videos are still processed. `stop()` disconnects the observer and is idempotent.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: all utility and discovery tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/video-discovery.js tests/helpers/fakes.js tests/video-discovery.test.js
git commit -m "feat: discover dynamic Instagram videos"
```

---

### Task 3: Shadow DOM Control View

**Files:**
- Create: `src/control-view.js`
- Modify: `tests/helpers/fakes.js`
- Create: `tests/control-view.test.js`

**Interfaces:**
- Consumes: `IGVC.media.ALLOWED_RATES`
- Produces: `IGVC.view.createControlView({ document, container, rates, onIntent }): ControlView`
- `onIntent(intent)` receives `{ type, value? }` where type is `toggle-play`, `seek-start`, `seek-preview`, `seek-commit`, `toggle-mute`, `volume`, `rate`, or `fullscreen`.
- `ControlView` exposes `setState(state)`, `setVisible(visible)`, `setError(kind)`, and `destroy()`.

- [ ] **Step 1: Extend the fake DOM and write failing view tests**

The fake element must support `append`, `remove`, `attachShadow`, `querySelector`, `addEventListener`, `dispatchEvent`, `classList`, `dataset`, `style`, `value`, `textContent`, and attributes.

Tests must assert:

```js
test("creates one namespaced shadow host in the supplied container", () => {
  const view = createControlView({ document, container, rates: ALLOWED_RATES, onIntent });
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].dataset.igvcHost, "");
  assert.ok(container.children[0].shadowRoot);
  view.destroy();
  assert.equal(container.children.length, 0);
});

test("control pointer and click events do not escape to Instagram", () => {
  const event = createEvent("pointerdown");
  controls.dispatchEvent(event);
  assert.equal(event.propagationStopped, true);
});

test("setState renders time, seek, volume, rate, and disabled duration", () => {
  view.setState({
    paused: false, currentTime: 65, duration: 120, volume: 0.4,
    muted: false, playbackRate: 1.25, seeking: false, fullscreen: false
  });
  assert.equal(time.textContent, "1:05 / 2:00");
  assert.equal(seek.value, "54.166666666666664");
  assert.equal(volume.value, "40");
  assert.equal(rate.value, "1.25");
});
```

Also test that pointer entry makes the view visible, inactivity hides it after the injected timer fires, and active range/select interaction prevents hiding.

- [ ] **Step 2: Run view tests and verify RED**

Run: `node --test tests/control-view.test.js`

Expected: FAIL because `src/control-view.js` does not exist.

- [ ] **Step 3: Implement the view**

Create a single host with `data-igvc-host=""`, an open Shadow Root, and internal `<style>`. The view contains:

- A seek range `0..100` with `step="0.01"`.
- A controls row with icon buttons, time text, volume range `0..100`, rate `<select>`, and fullscreen button.
- Inline SVG icons with `aria-hidden="true"`; Turkish `aria-label` and `title` strings.
- CSS variables, a dark blurred gradient, 10px radius, minimum 36px hit targets, visible focus rings, and a two-row layout below 430px host width.

Stop `pointerdown`, `mousedown`, `click`, and `dblclick` propagation within the panel. Do not call `preventDefault()` on range input events. Send the exact intent union listed above. `destroy()` clears the hide timer and removes the host.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/control-view.js tests/helpers/fakes.js tests/control-view.test.js
git commit -m "feat: add isolated modern video control view"
```

---

### Task 4: Per-Video Controller

**Files:**
- Create: `src/video-controller.js`
- Modify: `tests/helpers/fakes.js`
- Create: `tests/video-controller.test.js`

**Interfaces:**
- Consumes: `IGVC.media.seekTime`
- Consumes: `view.setState`, `view.setError`, `view.destroy`
- Produces: `IGVC.controller.createVideoController({ video, container, view, document }): { handleIntent(intent): Promise<void>, destroy(): void }`

- [ ] **Step 1: Write failing controller tests**

Use a fake video event target with mutable `paused`, `currentTime`, `duration`, `volume`, `muted`, and `playbackRate`. Tests must cover:

```js
test("media events publish authoritative video state", () => {
  const controller = createVideoController(setup);
  video.currentTime = 30;
  video.dispatchEvent(createEvent("timeupdate"));
  assert.equal(view.lastState.currentTime, 30);
});

test("seeking preview is not overwritten by timeupdate", async () => {
  await controller.handleIntent({ type: "seek-start" });
  await controller.handleIntent({ type: "seek-preview", value: 75 });
  video.currentTime = 10;
  video.dispatchEvent(createEvent("timeupdate"));
  assert.equal(view.lastState.seekPercent, 75);
  await controller.handleIntent({ type: "seek-commit", value: 75 });
  assert.equal(video.currentTime, 90);
});

test("fullscreen falls back from container to video", async () => {
  container.requestFullscreen = async () => { throw new Error("denied"); };
  video.requestFullscreen = async () => { video.fullscreenRequested = true; };
  await controller.handleIntent({ type: "fullscreen" });
  assert.equal(video.fullscreenRequested, true);
});
```

Also cover play rejection, pause, mute, volume clamping, allowed rate assignment, unknown duration, `fullscreenchange`, and `destroy()` removing listeners.

- [ ] **Step 2: Run controller tests and verify RED**

Run: `node --test tests/video-controller.test.js`

Expected: FAIL because `src/video-controller.js` does not exist.

- [ ] **Step 3: Implement the controller**

Subscribe to `play`, `pause`, `timeupdate`, `durationchange`, `loadedmetadata`, `volumechange`, `ratechange`, and `ended` on the video plus `fullscreenchange` on the document. Build state from the video after every event. While seeking, include `seekPercent` from the preview instead of deriving it from `currentTime`.

Intent behavior:

- `toggle-play`: call `pause()` when playing; otherwise await `play()` and retain paused state if rejected.
- `seek-start`: set private seeking state.
- `seek-preview`: store the clamped percentage.
- `seek-commit`: assign `media.seekTime(value, video.duration)` and clear seeking.
- `toggle-mute`: invert `video.muted`.
- `volume`: assign clamped `value / 100`; unmute when value is above zero.
- `rate`: assign only a rate in `ALLOWED_RATES`.
- `fullscreen`: exit when `document.fullscreenElement` exists; otherwise try container, then video, and call `view.setError("fullscreen")` if both reject.

`destroy()` removes every listener and calls `view.destroy()` exactly once.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/video-controller.js tests/helpers/fakes.js tests/video-controller.test.js
git commit -m "feat: synchronize controls with Instagram video"
```

---

### Task 5: Instagram Composition and Lifecycle

**Files:**
- Create: `src/content.js`
- Create: `tests/content.test.js`

**Interfaces:**
- Consumes: `IGVC.discovery.createVideoDiscovery`
- Consumes: `IGVC.view.createControlView`
- Consumes: `IGVC.controller.createVideoController`
- Produces: `IGVC.content.findOverlayContainer(video, window): Element`
- Produces: `IGVC.content.start({ document, window, MutationObserverClass, discoveryFactory?, viewFactory?, controllerFactory? }): { stop(): void }`

- [ ] **Step 1: Write failing composition tests**

Tests must assert that `findOverlayContainer` chooses the nearest ancestor whose rectangle approximately matches the video rectangle, falls back to `video.parentElement`, adds `position: relative` only when computed position is `static`, and does not create a second controller for an already enhanced video.

Test `start()` with injected discovery, view, and controller factories and assert that `stop()` stops discovery and destroys every live controller.

- [ ] **Step 2: Run composition tests and verify RED**

Run: `node --test tests/content.test.js`

Expected: FAIL because `src/content.js` does not exist.

- [ ] **Step 3: Implement composition**

Walk at most six ancestors. Select the first ancestor whose rectangle differs from the video's width and height by at most four CSS pixels and whose area is non-zero. Do not select `body` or `html`. Store the original inline `position` before assigning `relative`.

For each discovered video:

1. Find the container.
2. Create the view with callbacks forwarded to the controller.
3. Retain duplicate lookup in a `WeakMap` and lifecycle records in a `Set<{ video, controller, container, originalPosition }>`.
4. Observe document removals and call `destroy()` when a lifecycle record's video has `isConnected === false`; restore a position changed by the extension and remove that record.

Default the three optional factories to the corresponding `IGVC` modules. At file end, call `IGVC.content.start({ document, window, MutationObserverClass: MutationObserver })` only when running in a browser with `document.documentElement`.

- [ ] **Step 4: Run all tests and syntax checks**

Run: `npm test`

Expected: all tests pass.

Run:

```bash
node --check src/media-utils.js
node --check src/video-discovery.js
node --check src/control-view.js
node --check src/video-controller.js
node --check src/content.js
```

Expected: every command exits 0 with no output.

- [ ] **Step 5: Commit**

```bash
git add src/content.js tests/content.test.js
git commit -m "feat: attach controls across Instagram navigation"
```

---

### Task 6: Turkish Documentation and Release Verification

**Files:**
- Create: `README.md`
- Create: `docs/manual-test-checklist.md`

**Interfaces:**
- Consumes the completed unpacked extension.
- Produces installation, usage, privacy, troubleshooting, and release-check instructions.

- [ ] **Step 1: Write the manual acceptance checklist**

Create explicit unchecked items for:

- A post: play/pause, seek, elapsed/total time, volume, mute, every speed, fullscreen.
- A Reel: the same controls and correct overlay alignment.
- A Story: the same controls and no accidental previous/next Story navigation.
- In-app navigation among post, Reel, and Story without reload.
- Multiple feed videos controlling only their own media.
- Controls auto-hide, remain visible during interaction, and remain keyboard-focusable.
- Unknown duration and rejected fullscreen behavior.

- [ ] **Step 2: Write the Turkish README**

Document:

1. Open `chrome://extensions`.
2. Enable “Geliştirici modu”.
3. Choose “Paketlenmemiş öğe yükle”.
4. Select `C:\Users\USER\Desktop\projeler\instagram-video-controls`.
5. Refresh an already-open Instagram tab.

Include feature scope, privacy guarantees, how to update/reload the extension, and the note that Instagram DOM changes may require an extension update.

- [ ] **Step 3: Run fresh automated verification**

Run: `npm test`

Expected: all tests pass, zero failures.

Run: `git diff --check`

Expected: no output and exit code 0.

Run: `git status --short`

Expected before the documentation commit: only `README.md` and `docs/manual-test-checklist.md` are untracked.

- [ ] **Step 4: Inspect the manifest and complete available manual checks**

Run:

```bash
node -e "const m=require('./manifest.json'); if(m.permissions||m.host_permissions) throw Error('unexpected permissions'); if(m.content_scripts[0].matches[0]!=='https://www.instagram.com/*') throw Error('bad scope'); console.log('permissions ok')"
```

Expected: `permissions ok`.

Load the folder in Chrome and record each manual checklist result. If interactive Chrome extension loading is unavailable, leave those boxes unchecked and state that limitation without claiming manual verification.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/manual-test-checklist.md
git commit -m "docs: add installation and verification guide"
```
