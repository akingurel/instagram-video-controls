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
