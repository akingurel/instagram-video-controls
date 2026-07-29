(function () {
  const NEXT_LABELS = new Set(["İleri", "Next", "Sonraki"]);
  const PREVIOUS_LABELS = new Set(["Geri", "Previous", "Önceki"]);
  const PAUSE_LABELS = new Set(["Duraklat", "Pause"]);
  const PLAY_LABELS = new Set(["Oynat", "Play"]);
  const MIN_SCALE = 1;
  const MAX_SCALE = 10;
  const BUTTON_ZOOM_FACTOR = 1.25;
  const WHEEL_SENSITIVITY = 0.0015;

  function getRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return { width: 0, height: 0 };
    }
    return element.getBoundingClientRect();
  }

  function isVisible(element) {
    const rect = getRect(element);
    return rect.width > 0 && rect.height > 0;
  }

  function getImageSource(image) {
    return image.currentSrc || image.src || "";
  }

  function uniqueControls(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }
    return [
      ...new Set([
        ...root.querySelectorAll("button"),
        ...root.querySelectorAll('[role="button"]'),
      ]),
    ];
  }

  function findControl(root, labels) {
    return uniqueControls(root).find((control) => {
      const label = control.getAttribute && control.getAttribute("aria-label");
      return labels.has(label) && isVisible(control) && !control.disabled;
    }) || null;
  }

  function activateControl(control) {
    if (control && typeof control.click === "function") {
      control.click();
      return true;
    }
    return false;
  }

  function createPhotoController({
    context,
    trigger,
    view,
    document,
    window,
    geometry,
    MutationObserverClass =
      typeof MutationObserver === "undefined" ? null : MutationObserver,
    setTimeout: scheduleTimeout =
      typeof setTimeout === "undefined" ? () => null : setTimeout,
    clearTimeout: cancelTimeout =
      typeof clearTimeout === "undefined" ? () => {} : clearTimeout,
  }) {
    const state = {
      dragging: false,
      lastPointer: null,
      open: false,
      pointerId: null,
      scale: 1,
      x: 0,
      y: 0,
    };
    let sourceImage = context.image;
    let fittedImage = { width: 0, height: 0 };
    let destroyed = false;
    let sourceObserver = null;
    let carouselObserver = null;
    let carouselTimeout = null;
    let storyPausedByExtension = false;

    function collectCandidates() {
      if (
        !context.mediaRoot ||
        typeof context.mediaRoot.querySelectorAll !== "function"
      ) {
        return [sourceImage];
      }
      return [...context.mediaRoot.querySelectorAll("img")].filter((image) => {
        const rect = getRect(image);
        return (
          image.isConnected !== false &&
          image.naturalWidth >= 300 &&
          image.naturalHeight >= 300 &&
          rect.width >= 180 &&
          rect.height > 0
        );
      });
    }

    function navigationState() {
      const candidates = collectCandidates();
      const index = candidates.indexOf(sourceImage);
      return {
        candidates,
        index,
        hasPrevious:
          index > 0 || Boolean(findControl(context.mediaRoot, PREVIOUS_LABELS)),
        hasNext:
          (index >= 0 && index < candidates.length - 1) ||
          Boolean(findControl(context.mediaRoot, NEXT_LABELS)),
      };
    }

    function computeFittedImage() {
      fittedImage = geometry.fitImage(view.getViewportRect(), {
        width: sourceImage.naturalWidth,
        height: sourceImage.naturalHeight,
      });
    }

    function bounded(nextState) {
      return geometry.boundPan(
        nextState,
        view.getViewportRect(),
        fittedImage,
      );
    }

    function assignTransform(nextState) {
      const normalized = bounded(nextState);
      state.scale = normalized.scale;
      state.x = normalized.x;
      state.y = normalized.y;
      view.setState({
        scale: state.scale,
        x: state.x,
        y: state.y,
      });
    }

    function resetTransform() {
      state.scale = 1;
      state.x = 0;
      state.y = 0;
      state.dragging = false;
      state.pointerId = null;
      state.lastPointer = null;
    }

    function pointerFromClient(intent) {
      const viewport = view.getViewportRect();
      return {
        x: intent.clientX - viewport.left - viewport.width / 2,
        y: intent.clientY - viewport.top - viewport.height / 2,
      };
    }

    function applyZoom(nextScale, pointer) {
      const clampedScale = geometry.clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const zoomed = geometry.zoomAtPoint(state, pointer, clampedScale);
      assignTransform(zoomed);
    }

    function pauseStoryIfRunning() {
      if (context.kind !== "story") {
        return;
      }
      const pause = findControl(context.mediaRoot, PAUSE_LABELS);
      if (pause && activateControl(pause)) {
        storyPausedByExtension = true;
      }
    }

    function resumeStoryIfNeeded() {
      if (!storyPausedByExtension) {
        return;
      }
      const play = findControl(context.mediaRoot, PLAY_LABELS);
      if (play) {
        activateControl(play);
      }
      storyPausedByExtension = false;
    }

    function stopCarouselWait() {
      if (carouselObserver) {
        carouselObserver.disconnect();
        carouselObserver = null;
      }
      if (carouselTimeout !== null) {
        cancelTimeout(carouselTimeout);
        carouselTimeout = null;
      }
    }

    function renderSource(image) {
      sourceImage = image;
      resetTransform();
      computeFittedImage();
      const navigation = navigationState();
      view.setState({
        alt: image.alt || "",
        error: "",
        hasNext: navigation.hasNext,
        hasPrevious: navigation.hasPrevious,
        loading: !image.complete,
        scale: 1,
        src: getImageSource(image),
        x: 0,
        y: 0,
      });
    }

    function waitForCarouselImage(direction, currentSource) {
      if (!MutationObserverClass) {
        return;
      }
      stopCarouselWait();
      carouselObserver = new MutationObserverClass(() => {
        const candidates = collectCandidates();
        const alternatives = candidates.filter(
          (image) => getImageSource(image) !== currentSource,
        );
        const nextImage =
          direction === "next" ? alternatives.at(-1) : alternatives[0];
        if (!nextImage) {
          return;
        }
        stopCarouselWait();
        renderSource(nextImage);
      });
      carouselObserver.observe(context.mediaRoot, {
        childList: true,
        subtree: true,
      });
      carouselTimeout = scheduleTimeout(() => {
        stopCarouselWait();
        const navigation = navigationState();
        view.setState({
          hasNext: navigation.hasNext,
          hasPrevious: navigation.hasPrevious,
        });
      }, 1500);
    }

    function navigate(direction) {
      const navigation = navigationState();
      const offset = direction === "next" ? 1 : -1;
      const direct = navigation.candidates[navigation.index + offset];
      if (direct) {
        renderSource(direct);
        return;
      }

      const labels = direction === "next" ? NEXT_LABELS : PREVIOUS_LABELS;
      const nativeControl = findControl(context.mediaRoot, labels);
      if (!nativeControl) {
        return;
      }
      const currentSource = getImageSource(sourceImage);
      waitForCarouselImage(direction, currentSource);
      if (activateControl(nativeControl)) {
        view.setState({
          hasNext: false,
          hasPrevious: false,
        });
      } else {
        stopCarouselWait();
      }
    }

    function handleResize() {
      if (!state.open) {
        return;
      }
      computeFittedImage();
      assignTransform(state);
    }

    function watchSourceConnection() {
      if (!MutationObserverClass || sourceObserver) {
        return;
      }
      sourceObserver = new MutationObserverClass(() => {
        if (sourceImage.isConnected === false) {
          close();
        }
      });
      sourceObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    function stopSourceConnectionWatch() {
      if (!sourceObserver) {
        return;
      }
      sourceObserver.disconnect();
      sourceObserver = null;
    }

    function open() {
      if (destroyed || state.open) {
        return;
      }
      state.open = true;
      resetTransform();
      computeFittedImage();
      const navigation = navigationState();
      view.setIntentHandler(handleViewerIntent);
      view.open({
        alt: sourceImage.alt || "",
        hasNext: navigation.hasNext,
        hasPrevious: navigation.hasPrevious,
        returnFocus: trigger,
        src: getImageSource(sourceImage),
      });
      view.setState({
        error: "",
        hasNext: navigation.hasNext,
        hasPrevious: navigation.hasPrevious,
        loading: !sourceImage.complete,
        scale: 1,
        x: 0,
        y: 0,
      });
      window.addEventListener("resize", handleResize);
      watchSourceConnection();
      pauseStoryIfRunning();
    }

    function close() {
      if (!state.open) {
        return;
      }
      state.open = false;
      state.dragging = false;
      stopCarouselWait();
      stopSourceConnectionWatch();
      window.removeEventListener("resize", handleResize);
      resumeStoryIfNeeded();
      view.close();
    }

    function handleViewerIntent(intent) {
      if (!state.open || destroyed) {
        return;
      }

      switch (intent.type) {
        case "close":
          close();
          break;
        case "wheel":
          applyZoom(
            state.scale * Math.exp(-intent.deltaY * WHEEL_SENSITIVITY),
            pointerFromClient(intent),
          );
          break;
        case "zoom-in":
          applyZoom(state.scale * BUTTON_ZOOM_FACTOR, { x: 0, y: 0 });
          break;
        case "zoom-out":
          applyZoom(state.scale / BUTTON_ZOOM_FACTOR, { x: 0, y: 0 });
          break;
        case "reset":
          resetTransform();
          view.setState({ scale: 1, x: 0, y: 0 });
          break;
        case "pointer-down":
          if (state.scale > 1) {
            state.dragging = true;
            state.pointerId = intent.pointerId;
            state.lastPointer = {
              x: intent.clientX,
              y: intent.clientY,
            };
          }
          break;
        case "pointer-move":
          if (state.dragging && state.pointerId === intent.pointerId) {
            const next = {
              scale: state.scale,
              x: state.x + intent.clientX - state.lastPointer.x,
              y: state.y + intent.clientY - state.lastPointer.y,
            };
            state.lastPointer = {
              x: intent.clientX,
              y: intent.clientY,
            };
            assignTransform(next);
          }
          break;
        case "pointer-up":
          if (state.pointerId === intent.pointerId) {
            state.dragging = false;
            state.pointerId = null;
            state.lastPointer = null;
          }
          break;
        case "previous":
          navigate("previous");
          break;
        case "next":
          navigate("next");
          break;
        case "image-load":
          computeFittedImage();
          view.setState({ error: "", loading: false });
          break;
        case "image-error":
          view.setState({
            error: "Fotoğraf yüklenemedi.",
            loading: false,
          });
          break;
      }
    }

    const api = {
      close,
      destroy() {
        if (destroyed) {
          return;
        }
        close();
        stopCarouselWait();
        stopSourceConnectionWatch();
        window.removeEventListener("resize", handleResize);
        destroyed = true;
      },
      handleViewerIntent,
      open,
    };
    return api;
  }

  const photoController = { createPhotoController };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.photoController = photoController;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = photoController;
  }
})();
