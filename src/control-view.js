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
      seekPercent: 0,
      fullscreen: false,
      fullscreenAvailable: false,
    };
    let hideTimer = null;
    let interactionActive = false;
    let focusActive = false;

    host.setAttribute("data-igvc-host", "");
    host.setAttribute("tabindex", "0");
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", "Video kontrolleri");
    const root = host.attachShadow({ mode: "open" });
    const style = element(document, "style");
    style.textContent = `
      :host { position: absolute; inset: 0; display: flex; align-items: flex-end; width: 100%; height: 100%; z-index: 2147483647;
        container-type: inline-size; pointer-events: none; color: #fff; font: 13px/1.2 system-ui, sans-serif;
        --igvc-accent: #ff3b7f; --igvc-panel-bg: linear-gradient(135deg, rgb(13 13 18 / 92%), rgb(32 32 42 / 82%));
        --igvc-panel-border: rgb(255 255 255 / 16%); --igvc-control-bg: rgb(255 255 255 / 10%); }
      .igvc-panel { box-sizing: border-box; display: grid;
        grid-template-columns: auto minmax(72px, 1fr) auto auto minmax(56px, .35fr) auto auto;
        align-items: center; gap: 8px; width: calc(100% - 16px); margin: 8px; padding: 10px;
        background: var(--igvc-panel-bg); backdrop-filter: blur(16px); border: 1px solid var(--igvc-panel-border);
        position: relative; z-index: 1; border-radius: 10px; opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(4px);
        transition: opacity 160ms ease, transform 160ms ease, visibility 160ms ease; }
      :host(.igvc-visible) .igvc-panel { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0); }
      :host(:focus-visible) .igvc-panel { outline: 2px solid #fff; outline-offset: -2px; }
      button, input, select { min-height: 36px; accent-color: var(--igvc-accent); }
      button { display: inline-grid; place-items: center; min-width: 36px; border: 0; border-radius: 8px;
        color: inherit; background: var(--igvc-control-bg); cursor: pointer; }
      button:hover { background: rgb(255 255 255 / 19%); }
      button:disabled { cursor: not-allowed; opacity: .45; }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      input[type="range"] { flex: 1; min-width: 0; }
      .igvc-time { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .igvc-error { position: absolute; right: 10px; bottom: calc(100% + 6px); color: #ffd1df; }
      .igvc-error:empty { display: none; }
      @container (max-width: 430px) {
        .igvc-panel { grid-template-columns: auto auto minmax(48px, 1fr) auto auto;
          grid-template-areas: "seek seek seek seek time" "play mute volume rate fullscreen"; }
        [data-igvc-play] { grid-area: play; }
        [data-igvc-seek] { grid-area: seek; }
        [data-igvc-time] { grid-area: time; }
        [data-igvc-mute] { grid-area: mute; }
        [data-igvc-volume] { grid-area: volume; }
        [data-igvc-rate] { grid-area: rate; }
        [data-igvc-fullscreen] { grid-area: fullscreen; }
      }
    `;

    const panel = element(document, "div", { "data-igvc-panel": "" });
    panel.classList.add("igvc-panel");
    panel.style.pointerEvents = "none";
    panel.style.visibility = "hidden";
    const seek = element(document, "input", {
      type: "range",
      min: "0",
      max: "100",
      step: "0.01",
      "data-igvc-seek": "",
      "aria-label": "Videoda ilerle",
      title: "Videoda ilerle",
    });
    const play = iconButton(document, "Oynat veya duraklat", "data-igvc-play", ICONS.play);
    const time = element(document, "span", { "data-igvc-time": "" });
    time.classList.add("igvc-time");
    const mute = iconButton(document, "Sesi aç veya kapat", "data-igvc-mute", ICONS.volume);
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
    const fullscreen = iconButton(document, "Tam ekran", "data-igvc-fullscreen", ICONS.fullscreen);
    const error = element(document, "div", { "data-igvc-error": "" });
    error.classList.add("igvc-error");
    panel.append(play, seek, time, mute, volume, rate, fullscreen, error);
    root.append(style, panel);
    container.append(host);

    for (const type of ["pointerdown", "pointerup", "mousedown", "click", "dblclick", "keydown", "keyup"]) {
      panel.addEventListener(type, (event) => event.stopPropagation());
    }
    const hostKeyboardEvents = ["keydown", "keyup"];
    const containHostKeyboard = (event) => event.stopPropagation();
    for (const type of hostKeyboardEvents) {
      host.addEventListener(type, containHostKeyboard);
    }

    const revealFromContainer = () => {
      setVisible(true);
      scheduleHide();
    };
    const containerRevealEvents = ["pointermove", "pointerdown", "click"];
    for (const type of containerRevealEvents) {
      container.addEventListener(type, revealFromContainer);
    }
    host.addEventListener("focusin", keepVisibleForFocus);
    host.addEventListener("focusout", releaseFocus);

    bindButton(play, () => onIntent({ type: "toggle-play" }));
    bindButton(mute, () => onIntent({ type: "toggle-mute" }));
    bindButton(fullscreen, () => onIntent({ type: "fullscreen" }));

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

    function bindButton(control, click) {
      control.addEventListener("pointerdown", beginInteraction);
      control.addEventListener("pointerup", endInteraction);
      control.addEventListener("pointercancel", endInteraction);
      control.addEventListener("blur", endInteraction);
      control.addEventListener("click", click);
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

    function keepVisibleForFocus() {
      focusActive = true;
      setVisible(true);
      clearHideTimer();
    }

    function releaseFocus() {
      focusActive = false;
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
        if (!interactionActive && !focusActive) {
          setVisible(false);
        }
      }, 2200);
    }

    function setVisible(visible) {
      host.classList[visible ? "add" : "remove"]("igvc-visible");
      panel.style.pointerEvents = visible ? "auto" : "none";
      panel.style.visibility = visible ? "visible" : "hidden";
    }

    function setState(nextState) {
      Object.assign(state, nextState);
      const validDuration = Number.isFinite(state.duration) && state.duration > 0;
      seek.disabled = !validDuration;
      const playbackPercent = validDuration ? (state.currentTime / state.duration) * 100 : 0;
      const displayedPercent = state.seeking && Number.isFinite(state.seekPercent) ? state.seekPercent : playbackPercent;
      seek.value = String(Math.min(100, Math.max(0, displayedPercent)));
      volume.value = String(Math.round(state.volume * 100));
      rate.value = String(state.playbackRate);
      time.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
      play.setAttribute("aria-label", state.paused ? "Oynat" : "Duraklat");
      play.setAttribute("title", state.paused ? "Oynat" : "Duraklat");
      setIconPath(play, state.paused ? ICONS.play : ICONS.pause);
      mute.setAttribute("aria-label", state.muted ? "Sesi aç" : "Sesi kapat");
      mute.setAttribute("title", state.muted ? "Sesi aç" : "Sesi kapat");
      setIconPath(mute, state.muted ? ICONS.muted : ICONS.volume);
      fullscreen.setAttribute("aria-label", state.fullscreen ? "Tam ekrandan çık" : "Tam ekran");
      fullscreen.setAttribute("title", state.fullscreen ? "Tam ekrandan çık" : "Tam ekran");
      fullscreen.disabled = !state.fullscreenAvailable;
      fullscreen.setAttribute("aria-disabled", String(!state.fullscreenAvailable));
      setIconPath(fullscreen, state.fullscreen ? ICONS.exitFullscreen : ICONS.fullscreen);
    }

    function setError(kind) {
      error.textContent = kind ? "Video denetimleri kullanılamıyor." : "";
      error.setAttribute("role", kind ? "status" : "");
    }

    function destroy() {
      clearHideTimer();
      for (const type of containerRevealEvents) {
        container.removeEventListener(type, revealFromContainer);
      }
      for (const type of hostKeyboardEvents) {
        host.removeEventListener(type, containHostKeyboard);
      }
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

  function iconButton(document, label, dataName, pathData) {
    const button = element(document, "button", {
      type: "button",
      "aria-label": label,
      title: label,
      [dataName]: "",
    });
    const svg = element(document, "svg", { "aria-hidden": "true", viewBox: "0 0 24 24", width: "18", height: "18" });
    const path = element(document, "path", { d: pathData, fill: "currentColor" });
    svg.append(path);
    button.append(svg);
    return button;
  }

  function setIconPath(button, pathData) {
    button.querySelector("path").setAttribute("d", pathData);
  }

  const ICONS = Object.freeze({
    play: "M8 5v14l11-7z",
    pause: "M7 5h4v14H7zm6 0h4v14h-4z",
    volume: "M4 9v6h4l5 4V5L8 9z",
    muted: "M4 9v6h4l5 4V5L8 9zm11.4 3 2.6-2.6L19.4 11 16.8 13.6 19.4 16 18 17.4l-2.6-2.6-2.6 2.6-1.4-1.4 2.6-2.6-2.6-2.6 1.4-1.4z",
    fullscreen: "M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zm3 9h2v5h-5v-2h3zM5 14h2v3h3v2H5z",
    exitFullscreen: "M7 5v3h3v2H5V5zm7 0h5v5h-2V7h-3zm-9 9h5v2H7v3H5zm12 0h2v5h-5v-2h3z",
  });

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
