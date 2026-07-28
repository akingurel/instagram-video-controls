(function () {
  function findOverlayContainer(video, window) {
    const videoRect = video.getBoundingClientRect();
    let ancestor = video.parentElement;

    for (let depth = 0; ancestor && depth < 6; depth += 1) {
      if (!isDocumentRoot(ancestor, video.ownerDocument)) {
        const ancestorRect = ancestor.getBoundingClientRect();
        const hasArea = ancestorRect.width > 0 && ancestorRect.height > 0;
        const approximatelyMatches =
          Math.abs(ancestorRect.width - videoRect.width) <= 4 &&
          Math.abs(ancestorRect.height - videoRect.height) <= 4;

        if (hasArea && approximatelyMatches) {
          return ancestor;
        }
      }

      ancestor = ancestor.parentElement;
    }

    return video.parentElement;
  }

  function start({
    document,
    window,
    MutationObserverClass,
    discoveryFactory = globalThis.IGVC.discovery.createVideoDiscovery,
    viewFactory = globalThis.IGVC.view.createControlView,
    controllerFactory = globalThis.IGVC.controller.createVideoController,
  }) {
    const controllersByVideo = new WeakMap();
    const records = new Set();
    let stopped = false;
    let discovery;

    function enhance(video) {
      if (stopped || controllersByVideo.has(video)) {
        return;
      }

      const container = findOverlayContainer(video, window);
      let originalPosition = null;
      if (window.getComputedStyle(container).position === "static") {
        originalPosition = container.style.position;
        container.style.position = "relative";
      }

      let controller;
      const view = viewFactory({
        document,
        container,
        rates: (globalThis.IGVC.media && globalThis.IGVC.media.ALLOWED_RATES) || [],
        onIntent(intent) {
          return controller.handleIntent(intent);
        },
      });
      controller = controllerFactory({ video, container, view, document });
      controllersByVideo.set(video, controller);
      records.add({ video, controller, container, originalPosition });
    }

    function cleanup(record) {
      record.controller.destroy();
      if (record.originalPosition !== null) {
        record.container.style.position = record.originalPosition;
      }
      controllersByVideo.delete(record.video);
      records.delete(record);
    }

    discovery = discoveryFactory({
      root: document.documentElement,
      MutationObserverClass,
      enhance,
    });

    const removalObserver = new MutationObserverClass(() => {
      for (const record of [...records]) {
        if (record.video.isConnected === false) {
          cleanup(record);
        }
      }
    });
    removalObserver.observe(document.documentElement, { childList: true, subtree: true });
    discovery.start();

    return {
      stop() {
        if (stopped) {
          return;
        }

        stopped = true;
        discovery.stop();
        removalObserver.disconnect();
        for (const record of [...records]) {
          cleanup(record);
        }
      },
    };
  }

  function isDocumentRoot(element, document) {
    return (
      element === document.body ||
      element === document.documentElement ||
      element.tagName === "BODY" ||
      element.tagName === "HTML"
    );
  }

  const content = { findOverlayContainer, start };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.content = content;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = content;
  }

  if (
    typeof document !== "undefined" &&
    typeof window !== "undefined" &&
    typeof MutationObserver !== "undefined" &&
    document.documentElement
  ) {
    start({ document, window, MutationObserverClass: MutationObserver });
  }
})();
