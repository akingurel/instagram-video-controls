"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const iconSizes = [16, 32, 48, 128];

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);

  assert.ok(
    buffer.subarray(0, pngSignature.length).equals(pngSignature),
    `${filePath} geçerli bir PNG dosyası olmalı`
  );
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

test("extension icon PNG assets exist at every manifest size", () => {
  for (const size of iconSizes) {
    const iconPath = path.join(projectRoot, "icons", `icon${size}.png`);
    assert.deepEqual(readPngSize(iconPath), {
      width: size,
      height: size
    });
  }
});

test("manifest maps extension and action icons to every generated asset", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
  );
  const expectedIcons = Object.fromEntries(
    iconSizes.map((size) => [String(size), `icons/icon${size}.png`])
  );

  assert.deepEqual(manifest.icons, expectedIcons);
  assert.deepEqual(manifest.action, {
    default_icon: expectedIcons
  });
});
