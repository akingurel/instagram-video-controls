(function () {
  function findOverlayContainer(video, window) {
    const videoRect = video.getBoundingClientRect();
    const fallbackContainer = video.parentElement;
    let matchingContainer = null;
    let ancestor = video.parentElement;

    while (ancestor) {
      if (!isDocumentRoot(ancestor, video.ownerDocument)) {
        const ancestorRect = ancestor.getBoundingClientRect();
        const hasArea = ancestorRect.width > 0 && ancestorRect.height > 0;
        const approximatelyMatches =
          Math.abs(ancestorRect.width - videoRect.width) <= 4 &&
          Math.abs(ancestorRect.height - videoRect.height) <= 4;

        if (hasArea && approximatelyMatches) {
          matchingContainer = ancestor;
        }
      } else {
        break;
      }

      ancestor = ancestor.parentElement;
    }

    return matchingContainer || fallbackContainer;
  }

  function start({
    document,
    window,
    MutationObserverClass,
    discoveryFactory = globalThis.IGVC.discovery.createVideoDiscovery,
    viewFactory = globalThis.IGVC.view.createControlView,
    controllerFactory = globalThis.IGVC.controller.createVideoController,
    photoDiscoveryFactory =
      globalThis.IGVC.photoDiscovery &&
      globalThis.IGVC.photoDiscovery.createPhotoDiscovery,
    photoContextResolver =
      globalThis.IGVC.photoDiscovery &&
      globalThis.IGVC.photoDiscovery.findPhotoContext,
    photoTriggerFactory =
      globalThis.IGVC.photoTrigger &&
      globalThis.IGVC.photoTrigger.createPhotoTrigger,
    photoViewerFactory =
      globalThis.IGVC.photoViewer &&
      globalThis.IGVC.photoViewer.createPhotoViewer,
    photoControllerFactory =
      globalThis.IGVC.photoController &&
      globalThis.IGVC.photoController.createPhotoController,
    photoGeometry =
      globalThis.IGVC.photoGeometry,
  }) {
    const controllersByVideo = new WeakMap();
    const controllersByImage = new WeakMap();
    const positioningByContainer = new WeakMap();
    const records = new Set();
    const photoRecords = new Set();
    let stopped = false;
    let discovery;
    let photoDiscovery = null;
    const photoEnabled = Boolean(
      photoDiscoveryFactory &&
      photoContextResolver &&
      photoTriggerFactory &&
      photoViewerFactory &&
      photoControllerFactory &&
      photoGeometry,
    );
    const sharedPhotoViewer = photoEnabled
      ? photoViewerFactory({ document })
      : null;

    function enhance(video) {
      if (stopped || controllersByVideo.has(video)) {
        return;
      }

      const container = findOverlayContainer(video, window);
      retainPositioning(container);

      let controller;
      let view;
      try {
        view = viewFactory({
          document,
          container,
          rates: (globalThis.IGVC.media && globalThis.IGVC.media.ALLOWED_RATES) || [],
          onIntent(intent) {
            return controller.handleIntent(intent);
          },
        });
        controller = controllerFactory({ video, container, view, document });
        controllersByVideo.set(video, controller);
        records.add({ video, controller, container });
      } catch (error) {
        if (view && typeof view.destroy === "function") {
          view.destroy();
        }
        releasePositioning(container);
        throw error;
      }
    }

    function cleanup(record) {
      record.controller.destroy();
      releasePositioning(record.container);
      controllersByVideo.delete(record.video);
      records.delete(record);
      if (discovery && typeof discovery.release === "function") {
        discovery.release(record.video);
      }
    }

    function enhancePhoto(context) {
      const { image, container } = context;
      if (stopped || controllersByImage.has(image)) {
        return;
      }

      retainPositioning(container);
      let controller;
      let trigger;
      try {
        trigger = photoTriggerFactory({
          document,
          container,
          onOpen() {
            controller.open();
          },
        });
        controller = photoControllerFactory({
          context,
          trigger,
          view: sharedPhotoViewer,
          document,
          window,
          geometry: photoGeometry,
          MutationObserverClass,
        });
        controllersByImage.set(image, controller);
        photoRecords.add({ image, controller, trigger, container });
      } catch (error) {
        if (trigger && typeof trigger.destroy === "function") {
          trigger.destroy();
        }
        releasePositioning(container);
        throw error;
      }
    }

    function cleanupPhoto(record) {
      record.controller.destroy();
      record.trigger.destroy();
      releasePositioning(record.container);
      controllersByImage.delete(record.image);
      photoRecords.delete(record);
      if (photoDiscovery && typeof photoDiscovery.release === "function") {
        photoDiscovery.release(record.image);
      }
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

    if (photoEnabled) {
      photoDiscovery = photoDiscoveryFactory({
        root: document.documentElement,
        window,
        location: window.location,
        MutationObserverClass,
        enhance: enhancePhoto,
      });
    }

    const removalObserver = new MutationObserverClass(() => {
      for (const record of [...records]) {
        if (record.video.isConnected === false) {
          cleanup(record);
        } else if (!record.container.contains(record.video)) {
          cleanup(record);
          try {
            enhance(record.video);
          } catch (_error) {
            // A later mutation can retry a video whose new container is not ready yet.
          }
        }
      }

      for (const record of [...photoRecords]) {
        if (record.image.isConnected === false) {
          cleanupPhoto(record);
        } else if (!record.container.contains(record.image)) {
          cleanupPhoto(record);
          const nextContext = photoContextResolver(record.image, {
            window,
            location: window.location,
          });
          if (nextContext) {
            try {
              enhancePhoto(nextContext);
            } catch (_error) {
              // A later mutation can retry a photo whose new surface is not ready yet.
            }
          }
        }
      }
    });
    removalObserver.observe(document.documentElement, { childList: true, subtree: true });
    discovery.start();
    if (photoDiscovery) {
      photoDiscovery.start();
    }

    return {
      stop() {
        if (stopped) {
          return;
        }

        stopped = true;
        discovery.stop();
        if (photoDiscovery) {
          photoDiscovery.stop();
        }
        removalObserver.disconnect();
        for (const record of [...records]) {
          cleanup(record);
        }
        for (const record of [...photoRecords]) {
          cleanupPhoto(record);
        }
        if (sharedPhotoViewer) {
          sharedPhotoViewer.destroy();
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
