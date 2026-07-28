(function () {
  function createControlView({
    document,
    container,
    rates,
    onIntent,
    setTimeout = globalThis.setTimeout.bind(globalThis),
    clearTimeout = globalThis.clearTimeout.bind(globalThis),
  }) {
    const media = globalThis.IGVC && globalThis.IGVC.media;
    const formatTime = media ? media.formatTime : fallbackFormatTime;
    const host = document.createElement("div");
    const state = {
      paused: true,
      currentTime: 0,
      duration: Number.NaN,
      volume: 1,
      muted: false,
      playbackRate: 1,
      seeking: false,
      fullscreen: false,
    };
    let hideTimer = null;
    let interactionActive = false;

    host.setAttribute("data-igvc-host", "");
    const root = host.attachShadow({ mode: "open" });
    const style = element(document, "style");
    style.textContent = `
      :host { container-type: inline-size; color: #fff; font: 13px/1.2 system-ui, sans-serif; }
      .igvc-panel { box-sizing: border-box; display: grid; gap: 8px; padding: 10px;
        background: linear-gradient(135deg, rgb(13 13 18 / 92%), rgb(32 32 42 / 82%));
        backdrop-filter: blur(16px); border: 1px solid rgb(255 255 255 / 16%); border-radius: 10px;
        opacity: 0; transform: translateY(4px); transition: opacity 160ms ease, transform 160ms ease; }
      :host(.igvc-visible) .igvc-panel { opacity: 1; transform: translateY(0); }
      .igvc-row { display: flex; align-items: center; gap: 8px; }
      button, input, select { min-height: 36px; accent-color: #ff3b7f; }
      button { display: inline-grid; place-items: center; min-width: 36px; border: 0; border-radius: 8px;
        color: inherit; background: rgb(255 255 255 / 10%); cursor: pointer; }
      button:hover { background: rgb(255 255 255 / 19%); }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      input[type="range"] { flex: 1; min-width: 0; }
      .igvc-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .igvc-error { color: #ffd1df; min-height: 0; }
      @container (max-width: 430px) { .igvc-row { display: grid; grid-template-columns: auto auto 1fr auto auto; } .igvc-time { grid-column: 1 / -1; } }
    `;

    const panel = element(document, "div", { "data-igvc-panel": "" });
    panel.classList.add("igvc-panel");
    const seek = element(document, "input", {
      type: "range",
      min: "0",
      max: "100",
      step: "0.01",
      "data-igvc-seek": "",
      "aria-label": "Videoda ilerle",
      title: "Videoda ilerle",
    });
    const row = element(document, "div");
    row.classList.add("igvc-row");
    const play = iconButton(document, "Oynat veya duraklat", "data-igvc-play");
    const time = element(document, "span", { "data-igvc-time": "" });
    time.classList.add("igvc-time");
    const mute = iconButton(document, "Sesi aç veya kapat", "data-igvc-mute");
    const volume = element(document, "input", {
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      "data-igvc-volume": "",
      "aria-label": "Ses seviyesi",
      title: "Ses seviyesi",
    });
    const rate = element(document, "select", {
      "data-igvc-rate": "",
      "aria-label": "Oynatma hızı",
      title: "Oynatma hızı",
    });
    for (const playbackRate of rates) {
      const option = element(document, "option", { value: String(playbackRate) });
      option.textContent = `${playbackRate}×`;
      rate.append(option);
    }
    const fullscreen = iconButton(document, "Tam ekran", "data-igvc-fullscreen");
    const error = element(document, "div", { "data-igvc-error": "" });
    error.classList.add("igvc-error");
    row.append(play, time, mute, volume, rate, fullscreen);
    panel.append(seek, row, error);
    root.append(style, panel);
    container.append(host);

    for (const type of ["pointerdown", "mousedown", "click", "dblclick"]) {
      panel.addEventListener(type, (event) => event.stopPropagation());
    }

    panel.addEventListener("pointerenter", () => {
      setVisible(true);
      scheduleHide();
    });

    play.addEventListener("click", () => onIntent({ type: "toggle-play" }));
    mute.addEventListener("click", () => onIntent({ type: "toggle-mute" }));
    fullscreen.addEventListener("click", () => onIntent({ type: "fullscreen" }));

    bindRange(seek, {
      start: () => onIntent({ type: "seek-start" }),
      input: () => onIntent({ type: "seek-preview", value: Number(seek.value) }),
      commit: () => onIntent({ type: "seek-commit", value: Number(seek.value) }),
    });
    bindRange(volume, {
      input: () => onIntent({ type: "volume", value: Number(volume.value) }),
    });
    bindInteraction(rate, () => onIntent({ type: "rate", value: Number(rate.value) }));

    function bindRange(control, intents) {
      control.addEventListener("pointerdown", () => {
        beginInteraction();
        if (intents.start) {
          intents.start();
        }
      });
      control.addEventListener("input", () => {
        beginInteraction();
        if (intents.input) {
          intents.input();
        }
      });
      control.addEventListener("change", () => {
        if (intents.commit) {
          intents.commit();
        }
        endInteraction();
      });
      control.addEventListener("blur", endInteraction);
    }

    function bindInteraction(control, change) {
      control.addEventListener("pointerdown", beginInteraction);
      control.addEventListener("focus", beginInteraction);
      control.addEventListener("change", () => {
        change();
        endInteraction();
      });
      control.addEventListener("blur", endInteraction);
    }

    function beginInteraction() {
      interactionActive = true;
      setVisible(true);
      clearHideTimer();
    }

    function endInteraction() {
      interactionActive = false;
      scheduleHide();
    }

    function clearHideTimer() {
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function scheduleHide() {
      clearHideTimer();
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!interactionActive) {
          setVisible(false);
        }
      }, 2200);
    }

    function setVisible(visible) {
      host.classList[visible ? "add" : "remove"]("igvc-visible");
    }

    function setState(nextState) {
      Object.assign(state, nextState);
      const validDuration = Number.isFinite(state.duration) && state.duration > 0;
      seek.disabled = !validDuration;
      seek.value = validDuration ? String((state.currentTime / state.duration) * 100) : "0";
      volume.value = String(Math.round(state.volume * 100));
      rate.value = String(state.playbackRate);
      time.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
      play.setAttribute("aria-label", state.paused ? "Oynat" : "Duraklat");
      play.setAttribute("title", state.paused ? "Oynat" : "Duraklat");
      mute.setAttribute("aria-label", state.muted ? "Sesi aç" : "Sesi kapat");
      mute.setAttribute("title", state.muted ? "Sesi aç" : "Sesi kapat");
    }

    function setError(kind) {
      error.textContent = kind ? "Video denetimleri kullanılamıyor." : "";
      error.setAttribute("role", kind ? "status" : "");
    }

    function destroy() {
      clearHideTimer();
      host.remove();
    }

    setState(state);
    return { destroy, setError, setState, setVisible };
  }

  function element(document, tagName, attributes = {}) {
    const node = document.createElement(tagName);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    return node;
  }

  function iconButton(document, label, dataName) {
    const button = element(document, "button", {
      type: "button",
      "aria-label": label,
      title: label,
      [dataName]: "",
    });
    const svg = element(document, "svg", { "aria-hidden": "true", viewBox: "0 0 24 24", width: "18", height: "18" });
    const path = element(document, "path", { d: "M8 5v14l11-7z", fill: "currentColor" });
    svg.append(path);
    button.append(svg);
    return button;
  }

  function fallbackFormatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "--:--";
    }
    const total = Math.floor(Math.max(0, seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  const view = { createControlView };
  globalThis.IGVC = globalThis.IGVC || {};
  globalThis.IGVC.view = view;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = view;
  }
})();
