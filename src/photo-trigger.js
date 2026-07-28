(function () {
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const ISOLATED_EVENTS = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "click",
    "dblclick",
    "keydown",
    "keyup",
  ];

  const STYLES = `
    :host {
      position: absolute;
      inset: 0;
      z-index: 30;
      display: block;
      pointer-events: none;
      opacity: 0;
      transition: opacity 140ms ease;
    }

    :host(.igvc-photo-trigger-visible) {
      opacity: 1;
    }

    button {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      display: inline-grid;
      place-items: center;
      padding: 0;
      border: 1px solid rgb(255 255 255 / 18%);
      border-radius: 10px;
      color: #eaf6ff;
      background: rgb(12 12 16 / 52%);
      box-shadow: 0 5px 18px rgb(0 0 0 / 24%);
      backdrop-filter: blur(9px);
      cursor: zoom-in;
      pointer-events: auto;
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    button:hover {
      border-color: #60a5fa;
      background: rgb(20 35 52 / 72%);
      transform: translateY(-1px);
    }

    button:focus-visible {
      outline: 2px solid #60a5fa;
      outline-offset: 2px;
    }

    svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    @media (prefers-reduced-motion: reduce) {
      :host,
      button {
        transition: none;
      }
    }
  `;

  function createMagnifierIcon(document) {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", "m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z");
    svg.append(path);
    return svg;
  }

  function createPhotoTrigger({ document, container, onOpen }) {
    const host = document.createElement("span");
    host.setAttribute("data-igvc-photo-trigger", "");
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES;
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("aria-label", "Fotoğrafı büyüt");
    button.setAttribute("data-igvc-photo-open", "");
    button.append(createMagnifierIcon(document));
    root.append(style, button);
    container.append(host);

    let destroyed = false;

    function reveal() {
      host.classList.add("igvc-photo-trigger-visible");
    }

    function hide() {
      host.classList.remove("igvc-photo-trigger-visible");
    }

    function isolate(event) {
      event.stopPropagation();
    }

    function activate(event) {
      event.preventDefault();
      event.stopPropagation();
      onOpen();
    }

    function handleKeydown(event) {
      event.stopPropagation();
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }

    container.addEventListener("pointerenter", reveal);
    container.addEventListener("pointerleave", hide);
    button.addEventListener("focusin", reveal);
    button.addEventListener("focusout", hide);

    for (const type of ISOLATED_EVENTS) {
      if (type === "click" || type === "keydown") {
        continue;
      }
      button.addEventListener(type, isolate);
    }
    button.addEventListener("click", activate);
    button.addEventListener("keydown", handleKeydown);

    return {
      host,
      focus() {
        button.focus();
      },
      destroy() {
        if (destroyed) {
          return;
        }
        destroyed = true;
        container.removeEventListener("pointerenter", reveal);
        container.removeEventListener("pointerleave", hide);
        button.removeEventListener("focusin", reveal);
        button.removeEventListener("focusout", hide);
        for (const type of ISOLATED_EVENTS) {
          if (type === "click" || type === "keydown") {
            continue;
          }
          button.removeEventListener(type, isolate);
        }
        button.removeEventListener("click", activate);
        button.removeEventListener("keydown", handleKeydown);
        host.remove();
      },
    };
  }

  const photoTrigger = { createPhotoTrigger };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.photoTrigger = photoTrigger;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = photoTrigger;
  }
})();
