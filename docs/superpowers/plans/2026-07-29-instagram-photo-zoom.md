# Instagram Photo Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible fullscreen photo viewer for Instagram posts, carousels, and photo Stories with fluid cursor-anchored `1×–10×` zoom, bounded panning, carousel navigation, and Story pause/resume.

**Architecture:** Keep photo support independent from the existing video controls. Pure zoom geometry lives in `photo-geometry.js`; DOM discovery/context detection, trigger rendering, fullscreen rendering, and interaction orchestration each live in focused modules. `content.js` composes the photo lifecycle beside the existing video lifecycle, and `manifest.json` loads the new scripts in dependency order.

**Tech Stack:** Chrome Extension Manifest V3, dependency-free browser JavaScript, Shadow DOM, CSS transforms, `MutationObserver`, Node.js built-in test runner (`node --test`).

## Global Constraints

- Support only Instagram single-photo posts, photo carousels, and photo Stories.
- Do not add triggers to videos, avatars, profile-grid thumbnails, icons, recommendation thumbnails, or hidden carousel slides.
- Use a compact translucent interface with the existing ice-blue accent `#60a5fa`.
- Zoom must be fluid and cursor anchored from `1×` through `10×`.
- The image must never be pannable completely outside the viewport.
- Opening a photo Story must pause its progression; closing must restore only the state changed by the extension.
- Preserve every existing video-control behavior and test.
- Add no runtime dependency and request no additional extension permission.

---

## File Structure

- Create `src/photo-geometry.js`: pure scale, cursor-anchor, and pan-bound calculations.
- Create `src/photo-discovery.js`: candidate scanning, eligibility checks, context resolution, and mutation lifecycle.
- Create `src/photo-trigger.js`: isolated Shadow DOM magnifier button.
- Create `src/photo-viewer.js`: fullscreen Shadow DOM viewer and accessible controls.
- Create `src/photo-controller.js`: viewer state, wheel/pointer/keyboard handling, carousel adapter, Story pause/resume, and cleanup.
- Modify `src/content.js`: compose photo and video lifecycles without coupling them.
- Modify `manifest.json`: load photo scripts before `content.js` and update product description/version.
- Modify `tests/helpers/fakes.js`: add image, focus, pointer, selector, and document behavior required by photo tests.
- Create `tests/photo-geometry.test.js`.
- Create `tests/photo-discovery.test.js`.
- Create `tests/photo-trigger.test.js`.
- Create `tests/photo-viewer.test.js`.
- Create `tests/photo-controller.test.js`.
- Modify `tests/content.test.js`.
- Modify `README.md`.
- Modify `docs/manual-test-checklist.md`.

### Task 1: Test-Support Primitives and Zoom Geometry

**Files:**
- Modify: `tests/helpers/fakes.js`
- Create: `tests/photo-geometry.test.js`
- Create: `src/photo-geometry.js`

**Interfaces:**
- Produces: `clamp(value, minimum, maximum): number`
- Produces: `zoomAtPoint(state, pointer, nextScale): { scale, x, y }`
- Produces: `boundPan(state, viewport, image): { scale, x, y }`
- Produces: `fitImage(viewport, image): { width, height }`
- Produces: `FakeImage`, richer `createEvent(type, properties)`, and fake focus/pointer APIs used by all later tests.

- [ ] **Step 1: Extend the fakes through a failing geometry test**

Add `FakeImage` with `naturalWidth`, `naturalHeight`, `currentSrc`, `src`, `alt`, `complete`, and configurable `getBoundingClientRect()`. Extend `createEvent` so supplied properties such as `clientX`, `clientY`, `deltaY`, `pointerId`, `key`, and `shiftKey` are copied onto the event.

Create tests asserting:

```js
const state = { scale: 2, x: -100, y: -50 };
assert.deepEqual(
  zoomAtPoint(state, { x: 300, y: 200 }, 4),
  { scale: 4, x: -500, y: -300 },
);
assert.deepEqual(
  boundPan(
    { scale: 2, x: 900, y: -900 },
    { width: 800, height: 600 },
    { width: 600, height: 400 },
  ),
  { scale: 2, x: 200, y: -100 },
);
assert.deepEqual(
  fitImage({ width: 800, height: 600 }, { width: 1600, height: 900 }),
  { width: 800, height: 450 },
);
```

- [ ] **Step 2: Run the new test and verify failure**

Run: `node --test tests/photo-geometry.test.js`

Expected: FAIL because `src/photo-geometry.js` does not exist.

- [ ] **Step 3: Implement the pure geometry module**

Use cursor anchoring:

```js
const ratio = nextScale / state.scale;
return {
  scale: nextScale,
  x: pointer.x - (pointer.x - state.x) * ratio,
  y: pointer.y - (pointer.y - state.y) * ratio,
};
```

For each pan axis, calculate overflow as:

```js
const overflowX = Math.max(0, (image.width * state.scale - viewport.width) / 2);
const overflowY = Math.max(0, (image.height * state.scale - viewport.height) / 2);
```

Clamp `x` and `y` to the corresponding positive/negative overflow. Export through both `globalThis.IGVC.photoGeometry` and `module.exports`.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/photo-geometry.test.js`

Expected: PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/photo-geometry.js tests/photo-geometry.test.js tests/helpers/fakes.js
git commit -m "feat: add photo zoom geometry"
```

### Task 2: Photo Eligibility, Context, and Dynamic Discovery

**Files:**
- Create: `tests/photo-discovery.test.js`
- Create: `src/photo-discovery.js`

**Interfaces:**
- Consumes: DOM `HTMLImageElement`-like objects and `MutationObserverClass`.
- Produces: `findPhotoContext(image, { window, location }): null | { image, container, mediaRoot, kind }`
- Produces: `createPhotoDiscovery({ root, window, location, MutationObserverClass, enhance }): { start, stop, release }`
- `kind` is exactly `"post"` or `"story"`.

- [ ] **Step 1: Write failing eligibility and lifecycle tests**

Cover these exact cases:

```js
assert.equal(findPhotoContext(postImage, environment).kind, "post");
assert.equal(findPhotoContext(storyImage, storyEnvironment).kind, "story");
assert.equal(findPhotoContext(avatarImage, environment), null);
assert.equal(findPhotoContext(gridThumbnail, environment), null);
assert.equal(findPhotoContext(imageInsideVideoSurface, environment), null);
assert.equal(findPhotoContext(hiddenCarouselImage, environment), null);
```

Also verify initial `img` scanning, added-subtree-only scanning, duplicate suppression, failed enhancement retry, `release(image)` re-enhancement, and observer disconnection.

Fixture rules:

- A post candidate is inside `article`, has a visible rectangle at least `240×240` or area at least `90,000px²`, and has `naturalWidth` and `naturalHeight` at least `300`.
- A Story candidate uses a `/stories/` pathname and the same intrinsic-size rule.
- Exclude images inside `header`, `nav`, profile links, `[role="button"]` elements smaller than `120×120`, or any media container containing a visible `video`.
- Exclude candidates whose rectangle has zero area, `aria-hidden="true"`, or whose displayed width is below `180px`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/photo-discovery.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement context detection and discovery**

Use `closest("article")` for posts and the `/stories/` pathname plus the outermost visible rectangle-matching ancestor for Stories. Resolve `container` as the outermost non-document ancestor whose rectangle matches the image within four pixels. Set `mediaRoot` to the post `article` or Story container.

Scan `root.querySelectorAll("img")` at startup and only `record.addedNodes` afterward. Keep a `WeakSet` of enhanced images; remove an image from it if `enhance` throws or `release` is called.

Export through `globalThis.IGVC.photoDiscovery` and `module.exports`.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/photo-discovery.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/photo-discovery.js tests/photo-discovery.test.js
git commit -m "feat: discover Instagram content photos"
```

### Task 3: Isolated Magnifier Trigger

**Files:**
- Create: `tests/photo-trigger.test.js`
- Create: `src/photo-trigger.js`

**Interfaces:**
- Produces: `createPhotoTrigger({ document, container, onOpen }): { destroy, focus, host }`
- `onOpen()` is called once per activation.
- The host uses `data-igvc-photo-trigger` and an open Shadow DOM.

- [ ] **Step 1: Write failing trigger tests**

Verify:

- One host is appended to `container`.
- The host covers the container with `pointer-events:none`; only the `32×32` button receives input.
- The button is in the upper-right safe area, is translucent, uses `#60a5fa`, and has `aria-label="Fotoğrafı büyüt"`.
- The icon is a namespaced SVG magnifier.
- `click` and `Enter`/`Space` activate `onOpen`.
- `pointerdown`, `click`, `dblclick`, `keydown`, and `keyup` do not bubble to Instagram; activation calls `preventDefault()`.
- `destroy()` removes the host and every listener.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/photo-trigger.test.js`

Expected: FAIL because `src/photo-trigger.js` does not exist.

- [ ] **Step 3: Implement the trigger**

Build the host and styles in Shadow DOM. Use `createElementNS("http://www.w3.org/2000/svg", ...)` for the magnifier. Keep the host invisible until `container` hover or `:focus-within`, while preserving a visible keyboard focus ring. Stop propagation on isolated events and invoke `onOpen` only from click or keyboard activation.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/photo-trigger.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/photo-trigger.js tests/photo-trigger.test.js
git commit -m "feat: add photo zoom trigger"
```

### Task 4: Accessible Fullscreen Viewer

**Files:**
- Create: `tests/photo-viewer.test.js`
- Create: `src/photo-viewer.js`

**Interfaces:**
- Produces: `createPhotoViewer({ document }): PhotoViewer`
- `PhotoViewer.setIntentHandler(handler: (intent) => void): void`
- `PhotoViewer.open({ src, alt, hasPrevious, hasNext, returnFocus }): void`
- `PhotoViewer.setState({ src?, alt?, scale?, x?, y?, loading?, error?, hasPrevious?, hasNext? }): void`
- `PhotoViewer.getViewportRect(): { width, height, left, top }`
- `PhotoViewer.getImageRect(): { width, height, left, top }`
- `PhotoViewer.close(): void`
- `PhotoViewer.destroy(): void`
- Emits button/keyboard intents: `{ type: "close" | "zoom-in" | "zoom-out" | "reset" | "previous" | "next" }`.
- Emits normalized interaction intents: `{ type: "wheel", clientX, clientY, deltaY }`, `{ type: "pointer-down" | "pointer-move" | "pointer-up", clientX, clientY, pointerId }`.

- [ ] **Step 1: Write failing viewer tests**

Verify:

- A single fixed host is appended to `document.documentElement` with a Shadow DOM and top-level `z-index: 2147483647`.
- The dialog uses `role="dialog"`, `aria-modal="true"`, Turkish control labels, dark translucent background, compact controls, and `#60a5fa`.
- `open()` sets image `src`/`alt`, disables document scrolling while preserving the prior inline overflow value, and focuses the close button.
- `setState({ scale: 2.35, x: 20, y: -10 })` renders `2.35×` and `translate3d(20px, -10px, 0) scale(2.35)`.
- Loading and Turkish error states are mutually exclusive.
- Previous/next buttons reflect `hasPrevious`/`hasNext`.
- Blank-backdrop click emits `close`; clicks on image or controls do not.
- Wheel and pointer events on the stage emit normalized interaction intents, prevent Instagram defaults where required, and use pointer capture for an active drag.
- Tab and Shift+Tab wrap focus within the viewer.
- `close()` restores scrolling and the trigger focus.
- Reduced-motion media preference removes transform transitions.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/photo-viewer.test.js`

Expected: FAIL because `src/photo-viewer.js` does not exist.

- [ ] **Step 3: Implement the viewer**

Use one document-level host created lazily by `createPhotoViewer`. Keep presentation inside Shadow DOM. Add a centered stage, an `<img draggable="false">`, top controls for `−`, current ratio, `+`, reset, and close, plus side navigation buttons. Route button, keyboard, wheel, and pointer events to the currently registered `setIntentHandler` callback. Pointer capture remains a view responsibility; zoom and pan state remain controller responsibilities.

Use this transform order:

```js
image.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
```

Store `document.documentElement.style.overflow` and `document.body.style.overflow` before setting both to `"hidden"`. Restore exact stored values on close/destroy. Focus only viewer controls and restore `returnFocus` when still connected.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/photo-viewer.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/photo-viewer.js tests/photo-viewer.test.js
git commit -m "feat: add fullscreen photo viewer"
```

### Task 5: Zoom, Pan, Carousel, and Story Controller

**Files:**
- Create: `tests/photo-controller.test.js`
- Create: `src/photo-controller.js`

**Interfaces:**
- Consumes: `photoGeometry`, `view`, `{ image, container, mediaRoot, kind }`, `document`, and `window`.
- Produces: `createPhotoController({ context, trigger, view, document, window, geometry }): { open, close, destroy, handleViewerIntent }`
- The controller owns wheel, pointer, keyboard, carousel, image-load, Story, and DOM-disconnect state.

- [ ] **Step 1: Write failing zoom and pan tests**

Use a `1000×700` viewport and an `800×600` fitted image. Assert:

- `open()` passes `image.currentSrc || image.src` and the image alt text to the viewer.
- `open()` registers `handleViewerIntent` through `view.setIntentHandler`.
- Wheel `deltaY < 0` multiplies scale by `Math.exp(-deltaY * 0.0015)` and clamps it to `10`.
- Wheel `deltaY > 0` reduces scale but never below `1`.
- The viewer-relative pointer coordinates are passed to `zoomAtPoint`, preserving the pixel under the cursor.
- Pointer drag updates `x`/`y` from normalized pointer intents and passes the result through `boundPan`.
- Dragging at `1×` does not move the image.
- `zoom-in`, `zoom-out`, and `reset` intents update the same state; buttons use the stage center as the anchor.
- The ratio sent to the viewer retains numerical precision while the viewer handles display rounding.

- [ ] **Step 2: Run the focused controller test and verify failure**

Run: `node --test tests/photo-controller.test.js`

Expected: FAIL because `src/photo-controller.js` does not exist.

- [ ] **Step 3: Implement core controller interactions**

Initialize:

```js
const state = {
  open: false,
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  pointerId: null,
  lastPointer: null,
};
```

Handle normalized wheel/pointer intents from the view, convert client coordinates to stage-local coordinates, call the pure geometry functions, and render through `view.setState`. Listen for window resize while open; on image load or resize, recompute fitted dimensions and re-bound the current pan.

- [ ] **Step 4: Add failing carousel and Story tests**

Verify:

- Visible sibling photo candidates in the same `mediaRoot` are ordered by DOM order.
- `previous` and `next` switch the source and reset `{ scale:1, x:0, y:0 }`.
- When the next photo is not loaded, the controller activates the native button whose accessible label matches `İleri`, `Next`, `Sonraki`, `Geri`, `Previous`, or `Önceki`, waits for the discovery mutation callback, and disables navigation while waiting.
- A carousel video slide is skipped rather than opened.
- Image load clears the loading state; image error sets `error:"Fotoğraf yüklenemedi."` while leaving close controls usable.
- For `kind:"story"`, the controller first activates Instagram’s visible pause control only when a visible play/pause control reports the Story as running.
- Closing activates the visible resume control only if this controller paused the Story.
- If Story state cannot be identified safely, opening still works and no native control is clicked.
- `Escape`, arrow keys, `+`, `-`, and `0` map to the documented intents and are prevented from reaching Instagram while open.
- Disconnecting the source image closes the viewer; destroy restores Story state and removes listeners.

- [ ] **Step 5: Implement carousel and Story adapters**

Keep native-control lookup private to the controller:

```js
const NEXT_LABELS = new Set(["İleri", "Next", "Sonraki"]);
const PREVIOUS_LABELS = new Set(["Geri", "Previous", "Önceki"]);
const PAUSE_LABELS = new Set(["Duraklat", "Pause"]);
const PLAY_LABELS = new Set(["Oynat", "Play"]);
```

Search only within `context.mediaRoot` or the active Story surface, require a visible rectangle, and never click a control when its state is ambiguous. Observe the media root only while waiting for a native carousel transition and disconnect the observer after success, timeout, close, or destroy.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/photo-controller.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/photo-controller.js tests/photo-controller.test.js
git commit -m "feat: control photo zoom and navigation"
```

### Task 6: Compose Photo Lifecycle with Existing Video Controls

**Files:**
- Modify: `tests/content.test.js`
- Modify: `src/content.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: `createPhotoDiscovery`, `createPhotoTrigger`, `createPhotoViewer`, and `createPhotoController`.
- Changes `start(...)` to accept optional photo factories for tests while retaining all existing video factory defaults.
- Produces one shared photo viewer per document and one trigger/controller record per enhanced image.

- [ ] **Step 1: Write failing composition tests**

Extend the content fixture with photo factory spies. Verify:

- Video discovery still starts exactly once.
- Photo discovery starts exactly once.
- Enhancing a photo creates one trigger and one controller using the same resolved context.
- Every photo controller shares the same viewer instance.
- Trigger activation calls only its photo controller’s `open()`.
- A disconnected image destroys its trigger/controller and calls `photoDiscovery.release(image)`.
- A connected image moved to a new media container is rebound once.
- Partial trigger/controller construction failure cleans up and allows retry.
- `stop()` stops both discoveries, destroys all photo records, destroys the shared viewer once, and retains all existing video cleanup behavior.

- [ ] **Step 2: Run the content test and verify failure**

Run: `node --test tests/content.test.js`

Expected: FAIL because `start()` does not compose photo factories.

- [ ] **Step 3: Implement photo composition**

Add photo records separately from video records:

```js
const photoRecords = new Set();
const controllersByImage = new WeakMap();
const sharedPhotoViewer = photoViewerFactory({ document });
```

On photo enhancement, create the trigger with an `onOpen` closure, then create the controller and bind the closure to `controller.open()`. `controller.open()` registers its own `handleViewerIntent` callback on the shared viewer, so the most recently opened photo owns viewer interactions. Mirror the existing defensive construction and cleanup pattern without changing video function names or behavior.

Use one removal observer pass to clean disconnected/moved videos and images. A photo is moved when its current context resolves to a different container.

- [ ] **Step 4: Load scripts in manifest order**

Set version to `1.1.0`, update the description to mention photo zoom, and load:

```json
[
  "src/media-utils.js",
  "src/video-discovery.js",
  "src/control-view.js",
  "src/video-controller.js",
  "src/photo-geometry.js",
  "src/photo-discovery.js",
  "src/photo-trigger.js",
  "src/photo-viewer.js",
  "src/photo-controller.js",
  "src/content.js"
]
```

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/content.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS, including every pre-existing video test.

- [ ] **Step 6: Commit**

```powershell
git add manifest.json src/content.js tests/content.test.js
git commit -m "feat: integrate Instagram photo zoom"
```

### Task 7: Documentation, Regression Verification, and Live Instagram Check

**Files:**
- Modify: `README.md`
- Modify: `docs/manual-test-checklist.md`

**Interfaces:**
- No new runtime interfaces.
- Produces installation and manual verification instructions for version `1.1.0`.

- [ ] **Step 1: Document user-visible behavior**

Add a “Fotoğraf büyütme” section to `README.md` documenting:

- Supported surfaces
- Magnifier activation
- Fluid cursor-centered wheel zoom
- Dragging
- Carousel arrow controls
- Story pause/resume
- Keyboard shortcuts: `Esc`, arrows, `+`, `-`, `0`

State explicitly that profile thumbnails and videos do not receive a magnifier.

- [ ] **Step 2: Expand the manual checklist**

Add separate cases for:

1. Single-photo post
2. Mixed photo/video carousel
3. Photo Story
4. Avatar/profile-grid exclusion
5. Fluid cursor-anchor verification at multiple image points
6. `1×` lower and `10×` upper limits
7. Pan boundaries
8. Keyboard focus and shortcuts
9. Closing by backdrop, button, and `Esc`
10. Existing post/Reels/Story video controls

- [ ] **Step 3: Run automated verification**

Run: `npm test`

Expected: all tests PASS.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Reload and verify in Chrome**

Reload the unpacked extension at `chrome://extensions`, then test one live example of each supported surface. Inspect that:

- Only eligible photos show the magnifier.
- The point under the cursor remains visually stable during wheel zoom.
- Zoom and pan stay responsive at `10×`.
- Carousel transitions reset zoom.
- Story progression stops only while the viewer is open.
- Closing restores scroll, focus, and Story state.
- Existing custom video controls still seek, change volume, synchronize Instagram volume, change speed, and enter fullscreen.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md docs/manual-test-checklist.md
git commit -m "docs: document Instagram photo zoom"
```

- [ ] **Step 6: Final repository verification**

Run: `git status --short --branch`

Expected: clean working tree; local `master` is ahead of `origin/master` until the user explicitly authorizes publishing.

Run: `git log --oneline -10`

Expected: the photo feature commits appear after `e07e760`.

Do not push in this task. Publishing the new commits requires a separate explicit user instruction.
