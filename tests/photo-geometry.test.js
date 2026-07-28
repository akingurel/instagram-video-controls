const test = require("node:test");
const assert = require("node:assert/strict");
const {
  boundPan,
  clamp,
  fitImage,
  zoomAtPoint,
} = require("../src/photo-geometry.js");

test("clamp keeps values inside inclusive bounds", () => {
  assert.equal(clamp(-1, 1, 10), 1);
  assert.equal(clamp(4.5, 1, 10), 4.5);
  assert.equal(clamp(12, 1, 10), 10);
});

test("zoomAtPoint preserves the image point under the cursor", () => {
  const state = { scale: 2, x: -100, y: -50 };

  assert.deepEqual(
    zoomAtPoint(state, { x: 300, y: 200 }, 4),
    { scale: 4, x: -500, y: -300 },
  );
});

test("boundPan prevents a scaled image from leaving the viewport", () => {
  assert.deepEqual(
    boundPan(
      { scale: 2, x: 900, y: -900 },
      { width: 800, height: 600 },
      { width: 600, height: 400 },
    ),
    { scale: 2, x: 200, y: -100 },
  );
});

test("boundPan centers image axes that do not overflow", () => {
  assert.deepEqual(
    boundPan(
      { scale: 1, x: 90, y: -30 },
      { width: 800, height: 600 },
      { width: 600, height: 400 },
    ),
    { scale: 1, x: 0, y: 0 },
  );
});

test("fitImage contains a photo without changing its aspect ratio", () => {
  assert.deepEqual(
    fitImage({ width: 800, height: 600 }, { width: 1600, height: 900 }),
    { width: 800, height: 450 },
  );
  assert.deepEqual(
    fitImage({ width: 800, height: 600 }, { width: 900, height: 1600 }),
    { width: 337.5, height: 600 },
  );
});

test("fitImage returns a safe empty size for invalid image dimensions", () => {
  assert.deepEqual(
    fitImage({ width: 800, height: 600 }, { width: 0, height: 900 }),
    { width: 0, height: 0 },
  );
});
