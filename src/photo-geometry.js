(function () {
  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function zoomAtPoint(state, pointer, nextScale) {
    const currentScale = Number.isFinite(state.scale) && state.scale > 0 ? state.scale : 1;
    const ratio = nextScale / currentScale;

    return {
      scale: nextScale,
      x: pointer.x - (pointer.x - state.x) * ratio,
      y: pointer.y - (pointer.y - state.y) * ratio,
    };
  }

  function boundPan(state, viewport, image) {
    const scaledWidth = image.width * state.scale;
    const scaledHeight = image.height * state.scale;
    const overflowX = Math.max(0, (scaledWidth - viewport.width) / 2);
    const overflowY = Math.max(0, (scaledHeight - viewport.height) / 2);

    return {
      scale: state.scale,
      x: overflowX === 0 ? 0 : clamp(state.x, -overflowX, overflowX),
      y: overflowY === 0 ? 0 : clamp(state.y, -overflowY, overflowY),
    };
  }

  function fitImage(viewport, image) {
    if (
      !Number.isFinite(viewport.width) ||
      !Number.isFinite(viewport.height) ||
      !Number.isFinite(image.width) ||
      !Number.isFinite(image.height) ||
      viewport.width <= 0 ||
      viewport.height <= 0 ||
      image.width <= 0 ||
      image.height <= 0
    ) {
      return { width: 0, height: 0 };
    }

    const scale = Math.min(
      viewport.width / image.width,
      viewport.height / image.height,
    );

    return {
      width: image.width * scale,
      height: image.height * scale,
    };
  }

  const photoGeometry = { boundPan, clamp, fitImage, zoomAtPoint };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.photoGeometry = photoGeometry;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = photoGeometry;
  }
})();
