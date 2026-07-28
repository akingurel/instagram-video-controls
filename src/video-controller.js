(function () {
  function createVideoController({ video, container, view, document }) {
    const media = globalThis.IGVC && globalThis.IGVC.media;
    let destroyed = false;
    let seeking = false;
    let seekPercent = percentFromVideo();

    const videoEvents = [
      "play",
      "pause",
      "timeupdate",
      "durationchange",
      "loadedmetadata",
      "volumechange",
      "ratechange",
      "ended",
    ];
    const publishState = () => view.setState(stateFromVideo());

    videoEvents.forEach((type) => video.addEventListener(type, publishState));
    document.addEventListener("fullscreenchange", publishState);
    publishState();

    async function handleIntent(intent) {
      if (destroyed) {
        return;
      }

      switch (intent.type) {
        case "toggle-play":
          if (video.paused) {
            try {
              await video.play();
            } catch (_error) {}
            if (destroyed) {
              return;
            }
          } else {
            video.pause();
          }
          publishState();
          break;
        case "seek-start":
          seeking = true;
          seekPercent = percentFromVideo();
          publishState();
          break;
        case "seek-preview":
          seeking = true;
          seekPercent = clamp(intent.value, 0, 100);
          publishState();
          break;
        case "seek-commit":
          video.currentTime = media.seekTime(intent.value, video.duration);
          seeking = false;
          seekPercent = percentFromVideo();
          publishState();
          break;
        case "toggle-mute":
          video.muted = !video.muted;
          publishState();
          break;
        case "volume":
          video.volume = clamp(intent.value, 0, 100) / 100;
          if (video.volume > 0) {
            video.muted = false;
          }
          publishState();
          break;
        case "rate":
          if (media.ALLOWED_RATES.includes(intent.value)) {
            video.playbackRate = intent.value;
            publishState();
          }
          break;
        case "fullscreen":
          await toggleFullscreen();
          break;
      }
    }

    async function toggleFullscreen() {
      if (document.fullscreenElement) {
        if (typeof document.exitFullscreen === "function") {
          await document.exitFullscreen();
        }
        return;
      }

      try {
        await requestFullscreen(container);
        if (destroyed) {
          return;
        }
      } catch (_containerError) {
        if (destroyed) {
          return;
        }
        try {
          await requestFullscreen(video);
          if (destroyed) {
            return;
          }
        } catch (_videoError) {
          if (!destroyed) {
            view.setError("fullscreen");
          }
        }
      }
    }

    function requestFullscreen(element) {
      if (typeof element.requestFullscreen !== "function") {
        return Promise.reject(new Error("Fullscreen unavailable"));
      }
      return element.requestFullscreen();
    }

    function stateFromVideo() {
      return {
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        volume: video.volume,
        muted: video.muted,
        playbackRate: video.playbackRate,
        seeking,
        seekPercent: seeking ? seekPercent : percentFromVideo(),
        fullscreen: Boolean(document.fullscreenElement),
        fullscreenAvailable:
          typeof document.exitFullscreen === "function" ||
          typeof container.requestFullscreen === "function" ||
          typeof video.requestFullscreen === "function",
      };
    }

    function percentFromVideo() {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return 0;
      }
      return clamp((video.currentTime / video.duration) * 100, 0, 100);
    }

    function destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      videoEvents.forEach((type) => video.removeEventListener(type, publishState));
      document.removeEventListener("fullscreenchange", publishState);
      view.destroy();
    }

    return { handleIntent, destroy };
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return min;
    }
    return Math.min(max, Math.max(min, number));
  }

  const controller = { createVideoController };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.controller = controller;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = controller;
  }
})();
