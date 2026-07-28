(function () {
  const ALLOWED_RATES = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "--:--";
    }

    const totalSeconds = Math.floor(Math.max(0, seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    const paddedSeconds = String(remainingSeconds).padStart(2, "0");

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
    }

    return `${minutes}:${paddedSeconds}`;
  }

  function seekTime(percent, duration) {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }

    return (clamp(percent, 0, 100) / 100) * duration;
  }

  const media = { ALLOWED_RATES, formatTime, clamp, seekTime };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.media = media;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = media;
  }
})();
