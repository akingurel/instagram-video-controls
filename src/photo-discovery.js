(function () {
  const MIN_DISPLAY_WIDTH = 180;
  const MIN_INTRINSIC_SIZE = 300;
  const MIN_CONTENT_SIDE = 240;
  const MIN_CONTENT_AREA = 90000;

  function getRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return { height: 0, width: 0 };
    }
    return element.getBoundingClientRect();
  }

  function isVisible(element, window) {
    const rect = getRect(element);
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    if (element.getAttribute && element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    if (window && typeof window.getComputedStyle === "function") {
      const style = window.getComputedStyle(element);
      if (
        style &&
        (style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse")
      ) {
        return false;
      }
    }

    return true;
  }

  function isDocumentRoot(element, document) {
    return (
      element === document.body ||
      element === document.documentElement ||
      element.tagName === "BODY" ||
      element.tagName === "HTML"
    );
  }

  function approximatelyMatches(first, second) {
    return (
      Math.abs(first.width - second.width) <= 4 &&
      Math.abs(first.height - second.height) <= 4
    );
  }

  function findMatchingContainer(image) {
    const imageRect = getRect(image);
    const document = image.ownerDocument;
    let matchingContainer = image.parentElement;
    let ancestor = image.parentElement;

    while (ancestor && !isDocumentRoot(ancestor, document)) {
      const ancestorRect = getRect(ancestor);
      if (
        ancestorRect.width > 0 &&
        ancestorRect.height > 0 &&
        approximatelyMatches(ancestorRect, imageRect)
      ) {
        matchingContainer = ancestor;
      }
      ancestor = ancestor.parentElement;
    }

    return matchingContainer;
  }

  function hasVisibleVideo(mediaRoot, window) {
    if (!mediaRoot || typeof mediaRoot.querySelectorAll !== "function") {
      return false;
    }
    return [...mediaRoot.querySelectorAll("video")].some((video) =>
      isVisible(video, window),
    );
  }

  function findPhotoContext(image, { window, location }) {
    if (
      !image ||
      String(image.tagName).toUpperCase() !== "IMG" ||
      image.naturalWidth < MIN_INTRINSIC_SIZE ||
      image.naturalHeight < MIN_INTRINSIC_SIZE ||
      !isVisible(image, window)
    ) {
      return null;
    }

    const rect = getRect(image);
    const hasContentArea =
      (rect.width >= MIN_CONTENT_SIDE && rect.height >= MIN_CONTENT_SIDE) ||
      rect.width * rect.height >= MIN_CONTENT_AREA;
    if (rect.width < MIN_DISPLAY_WIDTH || !hasContentArea) {
      return null;
    }

    if (
      image.closest("header") ||
      image.closest("nav")
    ) {
      return null;
    }

    const buttonAncestor = image.closest('[role="button"]');
    if (buttonAncestor) {
      const buttonRect = getRect(buttonAncestor);
      if (buttonRect.width < 120 || buttonRect.height < 120) {
        return null;
      }
    }

    const postRoot = image.closest("article");
    const isStory =
      !postRoot &&
      location &&
      typeof location.pathname === "string" &&
      location.pathname.startsWith("/stories/");
    if (!postRoot && !isStory) {
      return null;
    }

    const container = findMatchingContainer(image);
    if (!container) {
      return null;
    }

    const mediaRoot = postRoot || container;
    if (hasVisibleVideo(mediaRoot, window)) {
      return null;
    }

    return {
      container,
      image,
      kind: postRoot ? "post" : "story",
      mediaRoot,
    };
  }

  function createPhotoDiscovery({
    root,
    window,
    location,
    MutationObserverClass,
    enhance,
  }) {
    const enhancedImages = new WeakSet();
    let observer = null;
    let started = false;

    function enhanceImage(image) {
      if (enhancedImages.has(image)) {
        return;
      }

      const context = findPhotoContext(image, { window, location });
      if (!context) {
        return;
      }

      enhancedImages.add(image);
      try {
        enhance(context);
      } catch (_error) {
        enhancedImages.delete(image);
      }
    }

    function scanImages(images) {
      for (const image of images) {
        enhanceImage(image);
      }
    }

    function scanAddedNode(node) {
      if (typeof node.matches === "function" && node.matches("img")) {
        enhanceImage(node);
      }
      if (typeof node.querySelectorAll === "function") {
        scanImages(node.querySelectorAll("img"));
      }
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      scanImages(root.querySelectorAll("img"));
      observer = new MutationObserverClass((records) => {
        for (const record of records) {
          for (const node of record.addedNodes || []) {
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

    function release(image) {
      enhancedImages.delete(image);
    }

    return { release, start, stop };
  }

  const photoDiscovery = { createPhotoDiscovery, findPhotoContext };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.photoDiscovery = photoDiscovery;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = photoDiscovery;
  }
})();
