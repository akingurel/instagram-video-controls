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
    const positioningByContainer = new WeakMap();
    const records = new Set();
    let stopped = false;
    let discovery;

    function enhance(video) {
      if (stopped || controllersByVideo.has(video)) {
        return;
      }

      const container = findOverlayContainer(video, window);
      const positioning = retainPositioning(container);

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
      records.add({ video, controller, container, originalPosition: positioning.originalPosition });
    }

    function cleanup(record) {
      record.controller.destroy();
      releasePositioning(record.container);
      controllersByVideo.delete(record.video);
      records.delete(record);
    }

    function retainPositioning(container) {
      let positioning = positioningByContainer.get(container);
      if (!positioning) {
        const changed = window.getComputedStyle(container).position === "static";
        positioning = {
          count: 0,
          originalPosition: changed ? container.style.position : null,
        };
        positioningByContainer.set(container, positioning);
        if (changed) {
          container.style.position = "relative";
        }
      }

      positioning.count += 1;
      return positioning;
    }

    function releasePositioning(container) {
      const positioning = positioningByContainer.get(container);
      positioning.count -= 1;
      if (positioning.count > 0) {
        return;
      }

      if (positioning.originalPosition !== null) {
        container.style.position = positioning.originalPosition;
      }
      positioningByContainer.delete(container);
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
