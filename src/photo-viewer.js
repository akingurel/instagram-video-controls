(function () {
  const STYLES = `
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: block;
      color: #f8fbff;
      font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    :host([hidden]) {
      display: none;
    }

    .igvc-photo-backdrop {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: rgb(0 0 0 / 88%);
      backdrop-filter: blur(8px);
      outline: none;
    }

    .igvc-photo-stage {
      position: absolute;
      inset: 58px 64px 24px;
      display: grid;
      place-items: center;
      overflow: hidden;
      touch-action: none;
      cursor: grab;
    }

    .igvc-photo-stage:active {
      cursor: grabbing;
    }

    .igvc-photo-image {
      display: block;
      max-width: 100%;
      max-height: 100%;
      max-height: calc(100vh - 82px);
      max-height: calc(100dvh - 82px);
      object-fit: contain;
      user-select: none;
      will-change: transform;
      transform-origin: center;
      transition: transform 80ms ease-out;
    }

    .igvc-photo-toolbar {
      position: absolute;
      top: 12px;
      left: 50%;
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px;
      border: 1px solid rgb(255 255 255 / 14%);
      border-radius: 12px;
      background: rgb(12 12 16 / 58%);
      box-shadow: 0 8px 28px rgb(0 0 0 / 28%);
      backdrop-filter: blur(12px);
      transform: translateX(-50%);
    }

    button {
      width: 34px;
      height: 34px;
      display: inline-grid;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 9px;
      color: inherit;
      background: transparent;
      font: inherit;
      font-size: 18px;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      color: #dff1ff;
      background: rgb(96 165 250 / 18%);
    }

    button:focus-visible {
      outline: 2px solid #60a5fa;
      outline-offset: 1px;
    }

    button:disabled {
      opacity: .3;
      cursor: default;
    }

    .igvc-photo-ratio {
      min-width: 54px;
      color: #dff1ff;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .igvc-photo-close {
      margin-left: 2px;
      border-left: 1px solid rgb(255 255 255 / 12%);
      border-radius: 0 9px 9px 0;
    }

    .igvc-photo-navigation {
      position: absolute;
      top: 50%;
      z-index: 3;
      width: 42px;
      height: 52px;
      background: rgb(12 12 16 / 52%);
      backdrop-filter: blur(10px);
      transform: translateY(-50%);
    }

    .igvc-photo-previous {
      left: 12px;
    }

    .igvc-photo-next {
      right: 12px;
    }

    .igvc-photo-status {
      position: absolute;
      left: 50%;
      bottom: 20px;
      z-index: 4;
      padding: 8px 12px;
      border-radius: 9px;
      background: rgb(12 12 16 / 70%);
      transform: translateX(-50%);
    }

    .igvc-photo-error {
      color: #ffd6d6;
    }

    [hidden] {
      display: none !important;
    }

    @media (max-width: 640px) {
      .igvc-photo-stage {
        inset: 58px 10px 20px;
      }

      .igvc-photo-image {
        max-height: calc(100vh - 78px);
        max-height: calc(100dvh - 78px);
      }

      .igvc-photo-navigation {
        bottom: 16px;
        top: auto;
        transform: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .igvc-photo-image {
        transition: none;
      }
    }
  `;

  function createButton(document, datasetName, label, text, className = "") {
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute(`data-${datasetName}`, "");
    button.setAttribute("aria-label", label);
    if (className) {
      button.classList.add(className);
    }
    button.textContent = text;
    return button;
  }

  function formatScale(scale) {
    const rounded = Math.round(scale * 100) / 100;
    return `${rounded.toFixed(2).replace(/\.?0+$/, "")}×`;
  }

  function rectSnapshot(element) {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };
  }

  function createPhotoViewer({ document }) {
    const host = document.createElement("div");
    host.setAttribute("data-igvc-photo-viewer", "");
    host.hidden = true;
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES;

    const backdrop = document.createElement("div");
    backdrop.classList.add("igvc-photo-backdrop");
    backdrop.setAttribute("data-igvc-photo-backdrop", "");
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "Fotoğraf görüntüleyici");
    backdrop.setAttribute("tabindex", "-1");

    const stage = document.createElement("div");
    stage.classList.add("igvc-photo-stage");
    stage.setAttribute("data-igvc-photo-stage", "");
    const image = document.createElement("img");
    image.classList.add("igvc-photo-image");
    image.setAttribute("data-igvc-photo-image", "");
    image.setAttribute("draggable", "false");
    stage.append(image);

    const close = createButton(
      document,
      "igvc-photo-close",
      "Kapat",
      "×",
      "igvc-photo-close",
    );
    const zoomOut = createButton(
      document,
      "igvc-photo-zoom-out",
      "Uzaklaştır",
      "−",
    );
    const ratio = document.createElement("span");
    ratio.classList.add("igvc-photo-ratio");
    ratio.setAttribute("data-igvc-photo-ratio", "");
    ratio.setAttribute("aria-live", "polite");
    ratio.textContent = "1×";
    const zoomIn = createButton(
      document,
      "igvc-photo-zoom-in",
      "Yakınlaştır",
      "+",
    );
    const reset = createButton(
      document,
      "igvc-photo-reset",
      "Görünümü sıfırla",
      "↺",
    );
    const toolbar = document.createElement("div");
    toolbar.classList.add("igvc-photo-toolbar");
    toolbar.append(zoomOut, ratio, zoomIn, reset, close);

    const previous = createButton(
      document,
      "igvc-photo-previous",
      "Önceki fotoğraf",
      "‹",
      "igvc-photo-navigation",
    );
    previous.classList.add("igvc-photo-previous");
    const next = createButton(
      document,
      "igvc-photo-next",
      "Sonraki fotoğraf",
      "›",
      "igvc-photo-navigation",
    );
    next.classList.add("igvc-photo-next");

    const loading = document.createElement("div");
    loading.classList.add("igvc-photo-status");
    loading.setAttribute("data-igvc-photo-loading", "");
    loading.setAttribute("role", "status");
    loading.textContent = "Fotoğraf yükleniyor…";
    loading.hidden = true;
    const error = document.createElement("div");
    error.classList.add("igvc-photo-status");
    error.classList.add("igvc-photo-error");
    error.setAttribute("data-igvc-photo-error", "");
    error.setAttribute("role", "alert");
    error.hidden = true;

    backdrop.append(stage, toolbar, previous, next, loading, error);
    root.append(style, backdrop);
    document.documentElement.append(host);

    const focusables = [close, zoomOut, zoomIn, previous, next, reset];
    const buttonIntents = new Map([
      [close, "close"],
      [zoomOut, "zoom-out"],
      [zoomIn, "zoom-in"],
      [reset, "reset"],
      [previous, "previous"],
      [next, "next"],
    ]);
    let intentHandler = () => {};
    let returnFocus = null;
    let savedHtmlOverflow = null;
    let savedBodyOverflow = null;
    let open = false;
    let destroyed = false;

    function emit(intent) {
      if (open && !destroyed) {
        intentHandler(intent);
      }
    }

    function handleButtonClick(event) {
      event.preventDefault();
      event.stopPropagation();
      const type = buttonIntents.get(event.currentTarget);
      if (!event.currentTarget.disabled) {
        emit({ type });
      }
    }

    function handleBackdropClick(event) {
      if (event.target === backdrop) {
        event.preventDefault();
        emit({ type: "close" });
      }
    }

    function enabledFocusables() {
      return focusables.filter((element) => !element.disabled);
    }

    function handleKeydown(event) {
      if (!open) {
        return;
      }

      if (event.key === "Tab") {
        const available = enabledFocusables();
        if (available.length === 0) {
          return;
        }
        const first = available[0];
        const last = available[available.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      const shortcuts = {
        Escape: "close",
        ArrowLeft: "previous",
        ArrowRight: "next",
        "+": "zoom-in",
        "=": "zoom-in",
        "-": "zoom-out",
        "0": "reset",
      };
      const type = shortcuts[event.key];
      if (!type) {
        return;
      }
      if (
        (type === "previous" && previous.disabled) ||
        (type === "next" && next.disabled)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      emit({ type });
    }

    function handleWheel(event) {
      if (!open) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      emit({
        type: "wheel",
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
    }

    function handlePointer(event) {
      if (!open) {
        return;
      }
      if (event.type === "pointerdown") {
        event.preventDefault();
        stage.setPointerCapture(event.pointerId);
      } else if (
        event.type === "pointerup" ||
        event.type === "pointercancel"
      ) {
        if (stage.hasPointerCapture(event.pointerId)) {
          stage.releasePointerCapture(event.pointerId);
        }
      }
      event.stopPropagation();
      emit({
        type: event.type === "pointerdown"
          ? "pointer-down"
          : event.type === "pointermove"
            ? "pointer-move"
            : "pointer-up",
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
      });
    }

    function handleImageLoad() {
      emit({ type: "image-load" });
    }

    function handleImageError() {
      emit({ type: "image-error" });
    }

    for (const button of buttonIntents.keys()) {
      button.addEventListener("click", handleButtonClick);
    }
    backdrop.addEventListener("click", handleBackdropClick);
    backdrop.addEventListener("keydown", handleKeydown);
    stage.addEventListener("wheel", handleWheel, { passive: false });
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      stage.addEventListener(type, handlePointer);
    }
    image.addEventListener("load", handleImageLoad);
    image.addEventListener("error", handleImageError);

    function closeViewer() {
      if (!open) {
        return;
      }
      open = false;
      host.hidden = true;
      document.documentElement.style.overflow = savedHtmlOverflow;
      if (document.body) {
        document.body.style.overflow = savedBodyOverflow;
      }
      if (
        returnFocus &&
        returnFocus.isConnected !== false &&
        typeof returnFocus.focus === "function"
      ) {
        returnFocus.focus();
      }
      returnFocus = null;
    }

    return {
      setIntentHandler(handler) {
        intentHandler = typeof handler === "function" ? handler : () => {};
      },
      open({
        src,
        alt = "",
        hasPrevious = false,
        hasNext = false,
        returnFocus: focusTarget = null,
      }) {
        if (destroyed) {
          return;
        }
        if (!open) {
          savedHtmlOverflow = document.documentElement.style.overflow;
          savedBodyOverflow = document.body ? document.body.style.overflow : undefined;
        }
        open = true;
        returnFocus = focusTarget;
        host.hidden = false;
        image.src = src;
        image.alt = alt;
        previous.disabled = !hasPrevious;
        next.disabled = !hasNext;
        loading.hidden = false;
        error.hidden = true;
        document.documentElement.style.overflow = "hidden";
        if (document.body) {
          document.body.style.overflow = "hidden";
        }
        close.focus();
      },
      setState(state) {
        if (state.src !== undefined) {
          image.src = state.src;
        }
        if (state.alt !== undefined) {
          image.alt = state.alt;
        }
        const scale = state.scale === undefined
          ? Number.parseFloat(image.dataset.igvcPhotoScale || "1")
          : state.scale;
        const x = state.x === undefined
          ? Number.parseFloat(image.dataset.igvcPhotoX || "0")
          : state.x;
        const y = state.y === undefined
          ? Number.parseFloat(image.dataset.igvcPhotoY || "0")
          : state.y;
        image.dataset.igvcPhotoScale = String(scale);
        image.dataset.igvcPhotoX = String(x);
        image.dataset.igvcPhotoY = String(y);
        image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        ratio.textContent = formatScale(scale);

        if (state.loading !== undefined) {
          loading.hidden = !state.loading;
        }
        if (state.error !== undefined) {
          error.textContent = state.error;
          error.hidden = !state.error;
        }
        if (state.hasPrevious !== undefined) {
          previous.disabled = !state.hasPrevious;
        }
        if (state.hasNext !== undefined) {
          next.disabled = !state.hasNext;
        }
      },
      getViewportRect() {
        return rectSnapshot(stage);
      },
      getImageRect() {
        return rectSnapshot(image);
      },
      close: closeViewer,
      destroy() {
        if (destroyed) {
          return;
        }
        closeViewer();
        destroyed = true;
        for (const button of buttonIntents.keys()) {
          button.removeEventListener("click", handleButtonClick);
        }
        backdrop.removeEventListener("click", handleBackdropClick);
        backdrop.removeEventListener("keydown", handleKeydown);
        stage.removeEventListener("wheel", handleWheel);
        for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
          stage.removeEventListener(type, handlePointer);
        }
        image.removeEventListener("load", handleImageLoad);
        image.removeEventListener("error", handleImageError);
        host.remove();
      },
    };
  }

  const photoViewer = { createPhotoViewer };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.photoViewer = photoViewer;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = photoViewer;
  }
})();
