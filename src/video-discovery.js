(function () {
  function createVideoDiscovery({ root, MutationObserverClass, enhance }) {
    const enhancedVideos = new WeakSet();
    let observer = null;
    let started = false;

    function enhanceVideo(video) {
      if (enhancedVideos.has(video)) {
        return;
      }

      enhancedVideos.add(video);
      try {
        enhance(video);
      } catch (_error) {
        enhancedVideos.delete(video);
        // A malformed video must not prevent discovery of later videos.
      }
    }

    function scanVideos(videos) {
      for (const video of videos) {
        enhanceVideo(video);
      }
    }

    function scanAddedNode(node) {
      if (typeof node.matches === "function" && node.matches("video")) {
        enhanceVideo(node);
      }

      if (typeof node.querySelectorAll === "function") {
        scanVideos(node.querySelectorAll("video"));
      }
    }

    function start() {
      if (started) {
        return;
      }

      started = true;
      scanVideos(root.querySelectorAll("video"));
      observer = new MutationObserverClass((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            scanAddedNode(node);
          }
        }
      });
      observer.observe(root, { childList: true, subtree: true });
    }

    function stop() {
      if (!observer) {
        return;
      }

      observer.disconnect();
      observer = null;
      started = false;
    }

    function release(video) {
      enhancedVideos.delete(video);
    }

    return { release, start, stop };
  }

  const discovery = { createVideoDiscovery };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.discovery = discovery;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = discovery;
  }
})();
