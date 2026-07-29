# Extension Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chrome’s default letter tile with a polished play-and-magnifier icon at every required extension size.

**Architecture:** Generate one high-resolution visual master, then derive deterministic `16`, `32`, `48`, and `128` pixel PNG assets from it. A dependency-free Node test will validate PNG headers, exact dimensions, and every manifest reference.

**Tech Stack:** OpenAI image generation, PNG, PowerShell/.NET image resizing, Chrome Extension Manifest V3, Node.js built-in test runner.

## Global Constraints

- Use a rounded-square dark-navy-to-ice-blue background.
- Use a bold white play triangle and a small magnifier at the lower-right.
- Keep the visual language aligned with accent color `#60a5fa`.
- Do not copy Instagram’s logo, camera mark, or official gradient.
- Produce exact `16×16`, `32×32`, `48×48`, and `128×128` PNG files.
- Add no permission, background script, popup, runtime dependency, or click behavior.

---

## File Structure

- Create `assets/extension-icon-source.png`: high-resolution generated visual master.
- Create `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`: Chrome-ready assets.
- Create `scripts/build-icons.ps1`: deterministic source-to-size conversion.
- Create `tests/icon-assets.test.js`: PNG and manifest contract verification.
- Modify `manifest.json`: top-level and toolbar icon declarations.

### Task 1: Generate and Derive Icon Assets

**Files:**
- Create: `assets/extension-icon-source.png`
- Create: `scripts/build-icons.ps1`
- Create: `icons/icon16.png`
- Create: `icons/icon32.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

**Interfaces:**
- Consumes: a square PNG at `assets/extension-icon-source.png`.
- Produces: four valid square PNG files whose dimensions match their filenames.

- [ ] **Step 1: Generate the visual master**

Use image generation with this exact art direction:

```text
Create a clean vector-style Chrome extension icon, square composition with transparent outer corners. A rounded-square background transitions subtly from deep navy (#0b1626) to ice blue (#60a5fa). Center a bold white play triangle. Place a small crisp magnifying-glass badge at the lower-right, with an ice-blue circular lens and white handle. Minimal geometric forms, no text, no letters, no Instagram logo, no camera icon, no official Instagram gradient, no mockup, no border outside the icon, optimized for readability at 16 pixels.
```

Save the chosen square output as `assets/extension-icon-source.png`.

- [ ] **Step 2: Add the deterministic resize script**

Create `scripts/build-icons.ps1` with `apply_patch`. It must load
`assets/extension-icon-source.png`, render each target onto a transparent
32-bit ARGB bitmap with high-quality bicubic interpolation, and save:

```powershell
$sizes = 16, 32, 48, 128
foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($source, 0, 0, $size, $size)
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}
```

Resolve all paths from `$PSScriptRoot`, create `icons` when absent, wrap resource
cleanup in `try/finally`, and fail if the source is not square.

- [ ] **Step 3: Build and visually inspect all sizes**

Run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/build-icons.ps1
```

Expected: four PNG files are created with no PowerShell error. Inspect the
`128px` version for polish and the `16px` version for a recognizable play
triangle and magnifier. If the small mark collapses, revise the source composition
instead of adding a second visual language.

- [ ] **Step 4: Commit the visual assets**

```powershell
git add assets/extension-icon-source.png icons scripts/build-icons.ps1
git commit -m "feat: add extension icon assets"
```

### Task 2: Manifest Integration and Automated Verification

**Files:**
- Create: `tests/icon-assets.test.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`.
- Produces: Manifest V3 `icons` and `action.default_icon` maps with keys `"16"`, `"32"`, `"48"`, and `"128"`.

- [ ] **Step 1: Write the failing asset contract test**

Read each PNG with `node:fs`. Validate the eight-byte PNG signature, read width
and height from IHDR offsets `16` and `20` as big-endian unsigned integers, and
assert:

```js
for (const size of [16, 32, 48, 128]) {
  const relativePath = `icons/icon${size}.png`;
  const buffer = readFileSync(join(projectRoot, relativePath));
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.readUInt32BE(16), size);
  assert.equal(buffer.readUInt32BE(20), size);
  assert.equal(manifest.icons[String(size)], relativePath);
  assert.equal(manifest.action.default_icon[String(size)], relativePath);
}
assert.equal(Object.hasOwn(manifest.action, "default_popup"), false);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/icon-assets.test.js`

Expected: FAIL because `manifest.icons` and `manifest.action` are not defined.

- [ ] **Step 3: Add manifest icon declarations**

Add:

```json
"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
},
"action": {
  "default_icon": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
},
```

Do not add `default_popup`, permissions, or background configuration.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/icon-assets.test.js`

Expected: PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
git diff --check
```

Expected: `manifest ok` and no whitespace errors.

- [ ] **Step 5: Reload in Chrome and inspect**

Reload the unpacked extension in `chrome://extensions`, then verify the custom
icon on the extension card and at toolbar size. The card must no longer show
Chrome’s default `I` letter tile.

- [ ] **Step 6: Commit integration**

```powershell
git add manifest.json tests/icon-assets.test.js
git commit -m "feat: register extension icons"
```
