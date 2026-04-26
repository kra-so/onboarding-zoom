/*!
 * onboarding-zoom v0.1.0
 * Cinematic, zoom-driven onboarding tours for live websites.
 * No dependencies. Drop-in via <script src="onboarding-zoom.js">.
 *
 * Quick start:
 *   const tour = OnboardingZoom.create({
 *     disableOn: { disableBelow: 900, touch: true },
 *     excludeFromCamera: ['.site-header'],
 *     scenes: [
 *       {
 *         target: '#editor',
 *         zoom: 1.6,
 *         title: 'Разметка текста',
 *         caption: 'Выделите фрагмент и нажмите цвет в палитре',
 *         actions: [
 *           { type: 'highlight', selector: '.paragraph', holdMs: 600 },
 *           { type: 'selectText', selector: '.paragraph', start: 0, end: 24, holdMs: 400 },
 *           { type: 'click', selector: '.marker[data-color="yellow"]', afterMs: 500 },
 *         ]
 *       },
 *       { target: '.legend', zoom: 2.0, title: 'Легенда',
 *         caption: 'Каждый пользователь — свой цвет',
 *         actions: [{ type: 'pulse', selector: '.legend-item', duration: 1400 }] }
 *     ]
 *   });
 *   tour.start();
 *
 * Public API:
 *   const tour = OnboardingZoom.create(options);
 *   tour.start() / tour.next() / tour.prev() / tour.skip() / tour.goto(i)
 *   tour.on('start' | 'sceneEnter' | 'sceneExit' | 'end' | 'skip', cb)
 *   OnboardingZoom.canRun(options) -> { ok, reason }
 */
(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.OnboardingZoom = factory();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const VERSION = '0.1.0';

  // -----------------------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------------------
  const DEFAULTS = {
    cameraRoot: 'body',          // selector or Element. 'body' wraps body children into a stage.
    excludeFromCamera: [],       // selectors to keep out of the zoom (auto-excludes fixed/sticky too).
    showControls: true,          // bottom HUD with title, caption, prev/next, close
    showCursor: true,            // animated fake cursor
    showDim: true,               // dim layer behind the content
    lockScroll: true,            // freeze body scroll during the tour
    closeOnEsc: true,
    keyboardNav: true,           // ArrowLeft / ArrowRight to step
    rememberDismiss: false,      // store "skipped" in localStorage and skip next runs
    storageKey: 'oz_tour_dismissed',
    transitionMs: 700,           // default camera transition duration
    fastFactor: 0.45,            // multiplier for camera duration on user-initiated next/prev/goto
    initialZoom: 1.4,            // default zoom level for scenes that don't specify one
    fitToViewport: true,         // auto-cap zoom so the target never overflows the viewport
    viewportFitRatio: 0.92,      // target should occupy at most this fraction of viewport when fit-capped
    revertOnEnd: false,          // snapshot innerHTML at start, restore at tour end
    snapshotTargets: null,       // selectors to snapshot individually; default = whole stage
    runOnce: false,              // auto-start once per browser; persist completion in localStorage
    theme: null,                 // 'dark' | 'light' | { bg, fg, accent, accent2, dim, spotlight, radius, ... }
    watchHtmlLang: false,        // observe <html lang="..."> changes and re-apply matching locale
    localeEventName: null,       // optional: also listen to a custom DOM event whose detail is locale code or object
    autoStart: false,            // start as soon as create() is called (after DOMReady)
    autoStartDelay: 0,
    interscene: 'direct',        // 'direct' or 'zoomOut' (briefly zooms out between scenes)
    interscenePadding: 0.6,      // when interscene='zoomOut', how much to zoom out (0..1)
    locale: 'en',                // string code (must be registered in OnboardingZoom.locales) or full object
    disableOn: {
      disableBelow: null,        // disable if window.innerWidth < this
      disableAbove: null,        // disable if window.innerWidth > this
      heightBelow: null,         // disable if window.innerHeight < this
      touch: false,              // disable on touch-capable devices
      coarsePointer: false,      // disable on pointer:coarse (most phones/tablets)
      mobile: false,             // disable based on user-agent (Mobi/Android/iPhone/iPad)
      userAgent: null,           // RegExp source string; disable if matches navigator.userAgent
      custom: null               // function() => boolean; true = disable
    },
    scenes: [],

    // event hooks (also via tour.on)
    onStart: null,
    onEnd: null,
    onSkip: null,
    onSceneEnter: null,
    onSceneExit: null
  };

  // -----------------------------------------------------------------------
  // Utils
  // -----------------------------------------------------------------------
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const easings = {
    linear: t => t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutQuart: t => 1 - Math.pow(1 - t, 4),
    easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
  };

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
      const t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
    });
  }

  function resolveEl(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof Element) return target;
    return null;
  }

  function injectStyles(css, id) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // Locale registry. Keyed by language code (e.g. 'en', 'ru', 'es').
  // English is the canonical fallback — every other locale fills in any missing keys from it.
  // Locale files (locales/*.js) register themselves into this object at load time.
  const LOCALES = {
    en: {
      next: 'Next',
      prev: 'Back',
      finish: 'Done',
      skip: 'Close',
      step: 'Step',
      onboarding: 'Onboarding'
    }
  };

  // Drain any locale files that loaded BEFORE the main library script.
  // Those files push to window.__OZ_LOCALES_PENDING__; we register them here.
  function drainPendingLocales() {
    if (typeof window === 'undefined') return;
    const pending = window.__OZ_LOCALES_PENDING__;
    if (!pending || !pending.length) return;
    pending.forEach(entry => {
      if (entry && entry.length === 2) LOCALES[entry[0]] = entry[1];
    });
    window.__OZ_LOCALES_PENDING__ = [];
  }
  drainPendingLocales();

  // Resolve `locale` option (string code or object) to a complete locale object.
  // - String code: look up in LOCALES, fallback to base language ('pt-BR' -> 'pt'),
  //   fallback to English if not registered.
  // - Object: deep-merged over English so partial overrides work.
  function resolveLocale(localeOpt) {
    const base = LOCALES.en;
    if (typeof localeOpt === 'string') {
      if (LOCALES[localeOpt]) return Object.assign({}, base, LOCALES[localeOpt]);
      if (localeOpt.indexOf('-') > -1) {
        const root = localeOpt.split('-')[0];
        if (LOCALES[root]) return Object.assign({}, base, LOCALES[root]);
      }
      if (typeof console !== 'undefined') {
        console.warn('[oz] locale not registered: "' + localeOpt + '" — falling back to "en". ' +
          'Did you include the matching locales/' + localeOpt + '.js file?');
      }
      return Object.assign({}, base);
    }
    if (localeOpt && typeof localeOpt === 'object') {
      return Object.assign({}, base, localeOpt);
    }
    return Object.assign({}, base);
  }

  // Theme presets — picked up by `theme: 'dark' | 'light'` in options.
  // Pass a plain object to override individual CSS variables.
  const THEMES = {
    dark: {
      bg: 'rgba(20, 22, 38, 0.94)',
      fg: '#ffffff',
      fgMuted: 'rgba(255, 255, 255, 0.85)',
      accent: 'rgba(99, 102, 241, 0.9)',
      accentStrong: 'rgba(99, 102, 241, 1)',
      accent2: '#a855f7',
      spotlight: 'rgba(99, 102, 241, 0.95)',
      dim: 'rgba(8, 12, 24, 0.42)',
      spotlightOverlay: 'rgba(8, 12, 24, 0.45)',
      track: 'rgba(255, 255, 255, 0.10)',
      trackHover: 'rgba(255, 255, 255, 0.18)',
      cursorRing: 'rgba(99, 102, 241, 0.5)',
      pulse: 'rgba(99, 102, 241, 0.7)',
      cursorFill: '#ffffff',
      cursorStroke: '#1f2937',
      shadow: '0 16px 48px rgba(0, 0, 0, 0.55)',
      shadowSoft: '0 8px 28px rgba(0, 0, 0, 0.4)',
      radius: '14px',
      radiusSm: '8px'
    },
    light: {
      bg: 'rgba(255, 255, 255, 0.96)',
      fg: '#1f2330',
      fgMuted: 'rgba(31, 35, 48, 0.78)',
      accent: '#6366f1',
      accentStrong: '#4f46e5',
      accent2: '#a855f7',
      spotlight: '#6366f1',
      dim: 'rgba(15, 23, 42, 0.28)',
      spotlightOverlay: 'rgba(15, 23, 42, 0.32)',
      track: 'rgba(15, 23, 42, 0.06)',
      trackHover: 'rgba(15, 23, 42, 0.12)',
      cursorRing: 'rgba(99, 102, 241, 0.45)',
      pulse: 'rgba(99, 102, 241, 0.65)',
      cursorFill: '#ffffff',
      cursorStroke: '#0f172a',
      shadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
      shadowSoft: '0 8px 28px rgba(15, 23, 42, 0.14)',
      radius: '14px',
      radiusSm: '8px'
    }
  };

  function camelToKebab(s) {
    return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  }

  function deepMerge(base, override) {
    const out = Object.assign({}, base);
    Object.keys(override || {}).forEach(k => {
      const v = override[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] !== null) {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  // -----------------------------------------------------------------------
  // Styles
  // -----------------------------------------------------------------------
  const STYLES = `
    :root {
      --oz-bg: rgba(20, 22, 38, 0.94);
      --oz-fg: #ffffff;
      --oz-fg-muted: rgba(255, 255, 255, 0.85);
      --oz-accent: rgba(99, 102, 241, 0.9);
      --oz-accent-strong: rgba(99, 102, 241, 1);
      --oz-accent-2: #a855f7;
      --oz-spotlight: rgba(99, 102, 241, 0.95);
      --oz-dim: rgba(8, 12, 24, 0.42);
      --oz-spotlight-overlay: rgba(8, 12, 24, 0.45);
      --oz-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
      --oz-shadow-soft: 0 8px 28px rgba(0, 0, 0, 0.4);
      --oz-radius: 14px;
      --oz-radius-sm: 8px;
      --oz-cursor-ring: rgba(99, 102, 241, 0.5);
      --oz-pulse: rgba(99, 102, 241, 0.7);
      --oz-track: rgba(255, 255, 255, 0.10);
      --oz-track-hover: rgba(255, 255, 255, 0.18);
      --oz-cursor-fill: #ffffff;
      --oz-cursor-stroke: #1f2937;
    }
    .oz-locked, .oz-locked body { overflow: hidden !important; }
    .oz-stage {
      transform-origin: 0 0;
      will-change: transform;
      backface-visibility: hidden;
    }
    .oz-dim {
      position: fixed; inset: 0;
      background: var(--oz-dim);
      pointer-events: none;
      z-index: 2147483640;
      opacity: 0;
      transition: opacity 280ms ease;
    }
    .oz-dim.oz-on { opacity: 1; }
    .oz-cursor {
      position: fixed; left: 0; top: 0;
      width: 28px; height: 28px;
      pointer-events: none;
      z-index: 2147483645;
      transform: translate(-200px, -200px);
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
      display: none;
    }
    .oz-cursor.oz-on { display: block; }
    .oz-cursor svg { width: 100%; height: 100%; display: block; }
    .oz-cursor svg path { fill: var(--oz-cursor-fill); stroke: var(--oz-cursor-stroke); }
    .oz-cursor::after {
      content: ''; position: absolute; left: 4px; top: 4px;
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--oz-cursor-ring);
      transform: scale(0); opacity: 0;
      pointer-events: none;
    }
    .oz-cursor.oz-click::after { animation: oz-ripple 480ms ease-out; }
    @keyframes oz-ripple {
      0%   { transform: scale(0.2); opacity: 1; }
      100% { transform: scale(2.6); opacity: 0; }
    }
    .oz-spotlight {
      position: fixed; left: -9999px; top: -9999px; width: 0; height: 0;
      border: 2px solid var(--oz-spotlight);
      border-radius: var(--oz-radius-sm);
      box-shadow: 0 0 0 9999px var(--oz-spotlight-overlay), 0 8px 32px rgba(0,0,0,0.35);
      pointer-events: none;
      z-index: 2147483642;
      opacity: 0;
      transition: opacity 220ms ease;
    }
    .oz-spotlight.oz-on { opacity: 1; }
    .oz-pulse {
      position: fixed;
      border-radius: 12px;
      pointer-events: none;
      z-index: 2147483643;
      box-shadow: 0 0 0 0 var(--oz-pulse);
      animation: oz-pulse 1.4s ease-out infinite;
    }
    @keyframes oz-pulse {
      0%   { box-shadow: 0 0 0 0 var(--oz-pulse); }
      100% { box-shadow: 0 0 0 24px transparent; }
    }
    .oz-hud {
      position: fixed; left: 50%; bottom: 24px;
      transform: translateX(-50%) translateY(20px);
      width: min(560px, calc(100vw - 32px));
      background: var(--oz-bg);
      color: var(--oz-fg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-radius: var(--oz-radius);
      padding: 16px 20px 14px;
      font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      box-shadow: var(--oz-shadow);
      z-index: 2147483646;
      opacity: 0;
      transition: opacity 240ms ease, transform 320ms cubic-bezier(.2,.8,.2,1);
      box-sizing: border-box;
    }
    .oz-hud.oz-on { opacity: 1; transform: translateX(-50%) translateY(0); }
    .oz-hud * { box-sizing: border-box; }
    .oz-hud-title { font-weight: 600; font-size: 15px; margin: 0 0 4px; padding-right: 32px; }
    .oz-hud-caption { color: var(--oz-fg-muted); margin: 0; padding-right: 8px; }
    .oz-hud-row {
      display: flex; gap: 8px; align-items: center; margin-top: 14px;
      justify-content: space-between;
    }
    .oz-hud-progress { font-size: 12px; opacity: 0.65; letter-spacing: 0.4px; font-variant-numeric: tabular-nums; }
    .oz-hud-buttons { display: flex; gap: 6px; }
    .oz-btn {
      appearance: none; border: 0; cursor: pointer;
      background: var(--oz-track);
      color: var(--oz-fg);
      padding: 8px 14px;
      border-radius: var(--oz-radius-sm);
      font: inherit; font-size: 13px; font-weight: 500;
      transition: background 120ms, opacity 120ms;
    }
    .oz-btn:hover { background: var(--oz-track-hover); }
    .oz-btn-primary { background: var(--oz-accent); }
    .oz-btn-primary:hover { background: var(--oz-accent-strong); }
    .oz-btn-ghost { background: transparent; opacity: 0.7; }
    .oz-btn-ghost:hover { background: var(--oz-track); opacity: 1; }
    .oz-btn:disabled { opacity: 0.35; cursor: default; }
    .oz-icon-close {
      position: absolute; top: 12px; right: 14px;
      width: 18px; height: 18px;
      padding: 0; margin: 0;
      background: transparent;
      border: 0; outline: 0; box-shadow: none;
      cursor: pointer;
      color: var(--oz-fg);
      opacity: 0.5;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 120ms;
    }
    .oz-icon-close:hover { opacity: 1; background: transparent; }
    .oz-icon-close:focus-visible { opacity: 1; outline: 1px solid var(--oz-accent); outline-offset: 4px; border-radius: 2px; }
    .oz-icon-close svg { width: 100%; height: 100%; display: block; }
    .oz-icon-close svg path { stroke: currentColor; }
    .oz-bar {
      height: 3px; background: var(--oz-track);
      border-radius: 2px; overflow: hidden;
      margin-top: 10px;
    }
    .oz-bar-inner {
      height: 100%;
      background: linear-gradient(90deg, var(--oz-accent), var(--oz-accent-2));
      width: 0%;
      transition: width 320ms ease;
    }
    .oz-hud-caption ul { margin: 6px 0 0; padding-left: 20px; }
    .oz-hud-caption ul li { margin-bottom: 4px; }
    .oz-hud-caption ul li:last-child { margin-bottom: 0; }
    .oz-hud-dots {
      display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;
    }
    .oz-dot {
      appearance: none; border: 0; cursor: pointer;
      width: 22px; height: 22px; padding: 0;
      border-radius: 50%;
      background: var(--oz-track);
      color: rgba(255,255,255,0.65);
      font: 11px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 600; text-align: center;
      transition: background 120ms, color 120ms, transform 120ms;
      font-variant-numeric: tabular-nums;
    }
    .oz-dot:hover { background: var(--oz-track-hover); color: var(--oz-fg); }
    .oz-dot.is-current {
      background: var(--oz-accent); color: var(--oz-fg); transform: scale(1.08);
    }
    .oz-dot.is-done { background: var(--oz-track-hover); color: var(--oz-fg-muted); }
    .oz-comment {
      position: fixed;
      max-width: 280px;
      background: var(--oz-bg);
      color: var(--oz-fg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 10px 12px;
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: var(--oz-shadow-soft);
      z-index: 2147483644;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 220ms ease, transform 240ms cubic-bezier(.2,.8,.2,1);
      pointer-events: none;
    }
    .oz-comment.oz-on { opacity: 1; transform: translateY(0); }
    .oz-comment::after {
      content: ''; position: absolute;
      width: 0; height: 0;
      border: 7px solid transparent;
    }
    .oz-comment[data-pos="top"]::after {
      bottom: -13px; left: var(--oz-arrow, 50%); transform: translateX(-50%);
      border-top-color: var(--oz-bg);
    }
    .oz-comment[data-pos="bottom"]::after {
      top: -13px; left: var(--oz-arrow, 50%); transform: translateX(-50%);
      border-bottom-color: var(--oz-bg);
    }
    .oz-comment[data-pos="left"]::after {
      right: -13px; top: 50%; transform: translateY(-50%);
      border-left-color: var(--oz-bg);
    }
    .oz-comment[data-pos="right"]::after {
      left: -13px; top: 50%; transform: translateY(-50%);
      border-right-color: var(--oz-bg);
    }
    .oz-comment-title { font-weight: 600; margin: 0 0 4px; font-size: 13px; }
    .oz-comment-body { margin: 0; color: var(--oz-fg-muted); }
    @media (prefers-reduced-motion: reduce) {
      .oz-spotlight, .oz-cursor, .oz-hud { transition-duration: 0ms !important; }
      .oz-pulse { animation: none !important; }
    }
  `;

  const CURSOR_SVG = '<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5 3 L5 22 L10 17 L13 23 L16 22 L13 16 L20 16 Z" ' +
    'fill="#fff" stroke="#1f2937" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  // -----------------------------------------------------------------------
  // Camera
  // -----------------------------------------------------------------------
  class Camera {
    constructor(rootEl, defaultMs) {
      this.root = rootEl;
      this.defaultMs = defaultMs;
      this.s = 1; this.tx = 0; this.ty = 0;
      this._raf = null;
    }
    apply() {
      this.root.style.transform = 'translate(' + this.tx + 'px, ' + this.ty + 'px) scale(' + this.s + ')';
    }
    set(s, tx, ty) {
      this.s = s; this.tx = tx; this.ty = ty;
      this.apply();
    }
    cancel() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    rectToLayout(viewportRect) {
      return {
        x: (viewportRect.left - this.tx) / this.s,
        y: (viewportRect.top - this.ty) / this.s,
        w: viewportRect.width / this.s,
        h: viewportRect.height / this.s
      };
    }
    cameraToCenter(targetEl, scale) {
      const rect = targetEl.getBoundingClientRect();
      const layout = this.rectToLayout(rect);
      const cx = layout.x + layout.w / 2;
      const cy = layout.y + layout.h / 2;
      return {
        s: scale,
        tx: window.innerWidth / 2 - cx * scale,
        ty: window.innerHeight / 2 - cy * scale
      };
    }
    animateTo(s, tx, ty, opts) {
      opts = opts || {};
      this.cancel();
      const dur = opts.duration != null ? opts.duration : this.defaultMs;
      const ease = easings[opts.easing] || easings.easeInOutCubic;
      const fromS = this.s, fromTx = this.tx, fromTy = this.ty;
      const start = performance.now();
      const signal = opts.signal;
      return new Promise((resolve, reject) => {
        if (dur <= 0) { this.set(s, tx, ty); return resolve(); }
        if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
        const tick = (now) => {
          if (signal && signal.aborted) { this._raf = null; return reject(new DOMException('aborted', 'AbortError')); }
          const t = clamp((now - start) / dur, 0, 1);
          const e = ease(t);
          this.s = fromS + (s - fromS) * e;
          this.tx = fromTx + (tx - fromTx) * e;
          this.ty = fromTy + (ty - fromTy) * e;
          this.apply();
          if (t < 1) this._raf = requestAnimationFrame(tick);
          else { this._raf = null; resolve(); }
        };
        this._raf = requestAnimationFrame(tick);
      });
    }
  }

  // -----------------------------------------------------------------------
  // Cursor
  // -----------------------------------------------------------------------
  class Cursor {
    constructor() {
      const el = document.createElement('div');
      el.className = 'oz-cursor';
      el.innerHTML = CURSOR_SVG;
      document.body.appendChild(el);
      this.el = el;
      this.x = -200; this.y = -200;
    }
    show() { this.el.classList.add('oz-on'); }
    hide() { this.el.classList.remove('oz-on'); }
    place(x, y) {
      this.x = x; this.y = y;
      this.el.style.transform = 'translate(' + (x - 4) + 'px, ' + (y - 4) + 'px)';
    }
    moveTo(x, y, dur, signal) {
      const fromX = this.x, fromY = this.y;
      const start = performance.now();
      dur = dur != null ? dur : 600;
      return new Promise((resolve, reject) => {
        if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
        if (dur <= 0) { this.place(x, y); return resolve(); }
        const tick = (now) => {
          if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
          const t = clamp((now - start) / dur, 0, 1);
          const e = easings.easeOutCubic(t);
          this.x = fromX + (x - fromX) * e;
          this.y = fromY + (y - fromY) * e;
          this.el.style.transform = 'translate(' + (this.x - 4) + 'px, ' + (this.y - 4) + 'px)';
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }
    click() {
      this.el.classList.remove('oz-click');
      void this.el.offsetWidth;
      this.el.classList.add('oz-click');
      setTimeout(() => this.el.classList.remove('oz-click'), 500);
    }
    destroy() { this.el.remove(); }
  }

  // -----------------------------------------------------------------------
  // Spotlight (highlight box around an element)
  // -----------------------------------------------------------------------
  class Spotlight {
    constructor() {
      const el = document.createElement('div');
      el.className = 'oz-spotlight';
      document.body.appendChild(el);
      this.el = el;
      this.target = null;
      this.padding = 6;
      this._raf = null;
    }
    // Tracks the target element each frame so the box follows camera transforms.
    show(target, padding) {
      this.target = target;
      this.padding = padding != null ? padding : 6;
      this.el.classList.add('oz-on');
      this._tick();
    }
    _tick() {
      if (!this.target) return;
      const r = this.target.getBoundingClientRect();
      const p = this.padding;
      this.el.style.left = (r.left - p) + 'px';
      this.el.style.top = (r.top - p) + 'px';
      this.el.style.width = (r.width + p * 2) + 'px';
      this.el.style.height = (r.height + p * 2) + 'px';
      this._raf = requestAnimationFrame(() => this._tick());
    }
    hide() {
      this.el.classList.remove('oz-on');
      this.target = null;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      // Move offscreen so a stale box never flashes between scenes.
      this.el.style.left = '-9999px';
      this.el.style.top = '-9999px';
      this.el.style.width = '0px';
      this.el.style.height = '0px';
    }
    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this.el.remove();
    }
  }

  // -----------------------------------------------------------------------
  // HUD (caption + prev/next/close + progress bar)
  // -----------------------------------------------------------------------
  class HUD {
    constructor(tour) {
      this.tour = tour;
      const t = tour.opts.locale;
      const el = document.createElement('div');
      el.className = 'oz-hud';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', t.onboarding || 'Onboarding');
      const closeSvg = '<svg viewBox="0 0 14 14" aria-hidden="true">' +
        '<path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" fill="none"/></svg>';
      el.innerHTML =
        '<button type="button" class="oz-icon-close" aria-label="' + (t.skip || 'Close') + '">' + closeSvg + '</button>' +
        '<h3 class="oz-hud-title"></h3>' +
        '<div class="oz-hud-caption"></div>' +
        '<div class="oz-bar"><div class="oz-bar-inner"></div></div>' +
        '<div class="oz-hud-dots" role="tablist"></div>' +
        '<div class="oz-hud-row">' +
          '<div class="oz-hud-progress"></div>' +
          '<div class="oz-hud-buttons">' +
            '<button class="oz-btn oz-btn-ghost" data-act="prev">‹ ' + t.prev + '</button>' +
            '<button class="oz-btn oz-btn-primary" data-act="next">' + t.next + ' ›</button>' +
          '</div>' +
        '</div>';
      this.el = el;
      this.title = el.querySelector('.oz-hud-title');
      this.caption = el.querySelector('.oz-hud-caption');
      this.progress = el.querySelector('.oz-hud-progress');
      this.bar = el.querySelector('.oz-bar-inner');
      this.dotsEl = el.querySelector('.oz-hud-dots');
      this.btnPrev = el.querySelector('[data-act="prev"]');
      this.btnNext = el.querySelector('[data-act="next"]');
      el.querySelector('.oz-icon-close').addEventListener('click', () => tour.skip());
      this.btnPrev.addEventListener('click', () => tour.prev());
      this.btnNext.addEventListener('click', () => tour.next());
      this._buildDots();
      document.body.appendChild(el);
    }
    _buildDots() {
      const scenes = this.tour.scenes || [];
      const t = this.tour.opts.locale;
      this.dotsEl.innerHTML = '';
      if (scenes.length <= 1) { this.dotsEl.style.display = 'none'; return; }
      scenes.forEach((s, i) => {
        const d = document.createElement('button');
        d.className = 'oz-dot';
        d.type = 'button';
        d.textContent = String(i + 1);
        const fallback = (t.step || 'Step') + ' ' + (i + 1);
        d.title = s.title || fallback;
        d.setAttribute('aria-label', s.title || fallback);
        d.addEventListener('click', () => this.tour.goto(i));
        this.dotsEl.appendChild(d);
      });
    }
    _renderCaption(caption) {
      this.caption.innerHTML = '';
      if (caption == null || caption === '') {
        this.caption.style.display = 'none';
        return;
      }
      this.caption.style.display = '';
      if (Array.isArray(caption)) {
        if (caption.length === 1) {
          const p = document.createElement('p');
          p.textContent = caption[0];
          p.style.margin = '0';
          this.caption.appendChild(p);
        } else {
          const ul = document.createElement('ul');
          caption.forEach(line => {
            const li = document.createElement('li');
            li.textContent = line;
            ul.appendChild(li);
          });
          this.caption.appendChild(ul);
        }
      } else if (typeof caption === 'string') {
        const p = document.createElement('p');
        p.textContent = caption;
        p.style.margin = '0';
        this.caption.appendChild(p);
      } else if (caption && caption.html) {
        this.caption.innerHTML = caption.html;
      }
    }
    show() { this.el.classList.add('oz-on'); }
    hide() { this.el.classList.remove('oz-on'); }
    refreshLocale() {
      const t = this.tour.opts.locale;
      this.el.setAttribute('aria-label', t.onboarding || 'Onboarding');
      const close = this.el.querySelector('.oz-icon-close');
      if (close) close.setAttribute('aria-label', t.skip || 'Close');
      this.btnPrev.textContent = '‹ ' + t.prev;
      const idx = this.tour.idx;
      const total = this.tour.scenes.length;
      const isLast = idx >= total - 1;
      this.btnNext.textContent = (idx >= 0 && isLast)
        ? t.finish
        : (t.next + ' ›');
      // Rebuild dots so the "Шаг N" / "Step N" fallback labels come out in the new language.
      this._buildDots();
      if (idx >= 0) {
        const dots = this.dotsEl.querySelectorAll('.oz-dot');
        dots.forEach((d, i) => {
          d.classList.toggle('is-current', i === idx);
          d.classList.toggle('is-done', i < idx);
        });
      }
    }
    update(state) {
      const t = this.tour.opts.locale;
      this.title.textContent = state.title || '';
      this.title.style.display = state.title ? '' : 'none';
      this._renderCaption(state.caption);
      this.progress.textContent = (state.current + 1) + ' / ' + state.total;
      this.bar.style.width = (((state.current + 1) / state.total) * 100) + '%';
      this.btnPrev.disabled = state.current <= 0;
      this.btnNext.textContent = (state.current >= state.total - 1)
        ? t.finish
        : (t.next + ' ›');
      // sync dots
      const dots = this.dotsEl.querySelectorAll('.oz-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('is-current', i === state.current);
        d.classList.toggle('is-done', i < state.current);
      });
    }
    destroy() { this.el.remove(); }
  }

  // -----------------------------------------------------------------------
  // Device guard
  // -----------------------------------------------------------------------
  function shouldDisable(opts) {
    const o = opts.disableOn || {};
    const w = window.innerWidth, h = window.innerHeight;
    if (o.disableBelow != null && w < o.disableBelow) return 'belowMinWidth';
    if (o.disableAbove != null && w > o.disableAbove) return 'aboveMaxWidth';
    if (o.heightBelow != null && h < o.heightBelow) return 'heightBelow';
    if (o.touch && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0)) return 'touch';
    if (o.coarsePointer && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return 'coarsePointer';
    if (o.mobile && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'mobile';
    if (o.userAgent) {
      const re = (o.userAgent instanceof RegExp) ? o.userAgent : new RegExp(o.userAgent);
      if (re.test(navigator.userAgent)) return 'userAgent';
    }
    if (typeof o.custom === 'function' && o.custom()) return 'custom';
    return false;
  }

  // -----------------------------------------------------------------------
  // Action library
  // -----------------------------------------------------------------------
  const ACTIONS = {
    async wait(a, ctx) { await sleep(a.ms != null ? a.ms : 500, ctx.signal); },

    async waitFor(a, ctx) {
      const sel = a.selector;
      const timeout = a.timeout != null ? a.timeout : 5000;
      if (resolveEl(sel)) return;
      await new Promise((resolve, reject) => {
        let done = false;
        const finish = (ok) => { if (done) return; done = true; obs.disconnect(); clearTimeout(to); ok ? resolve() : resolve(); };
        const obs = new MutationObserver(() => { if (resolveEl(sel)) finish(true); });
        obs.observe(document.body, { childList: true, subtree: true });
        const to = setTimeout(() => finish(false), timeout);
        if (ctx.signal) ctx.signal.addEventListener('abort', () => { obs.disconnect(); clearTimeout(to); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
      });
    },

    async moveCursor(a, ctx) {
      if (!ctx.cursor) return;
      let x, y;
      if (a.selector) {
        const el = resolveEl(a.selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        x = r.left + (a.offsetX != null ? a.offsetX : r.width / 2);
        y = r.top + (a.offsetY != null ? a.offsetY : r.height / 2);
      } else { x = a.x || 0; y = a.y || 0; }
      await ctx.cursor.moveTo(x, y, a.duration, ctx.signal);
    },

    async click(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      if (ctx.cursor && a.move !== false) {
        const r = el.getBoundingClientRect();
        await ctx.cursor.moveTo(r.left + r.width / 2, r.top + r.height / 2, a.moveDuration, ctx.signal);
      }
      if (ctx.cursor) ctx.cursor.click();
      await sleep(120, ctx.signal);
      if (a.dispatch !== false) {
        try { el.click(); }
        catch (e) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      }
      if (a.afterMs) await sleep(a.afterMs, ctx.signal);
    },

    async type(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      const text = a.text || '';
      const speed = a.speed != null ? a.speed : 60;
      try { el.focus(); } catch (e) {}
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ctx.signal && ctx.signal.aborted) throw new DOMException('aborted', 'AbortError');
        if ('value' in el) {
          el.value = (el.value || '') + ch;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          el.textContent = (el.textContent || '') + ch;
        }
        await sleep(speed, ctx.signal);
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },

    async selectText(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      const node = a.deep ? el : (el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : el);
      const start = a.start != null ? a.start : 0;
      const len = (node.textContent || '').length;
      const end = a.end != null ? Math.min(a.end, len) : len;
      try {
        const range = document.createRange();
        if (node.nodeType === 3) {
          range.setStart(node, start);
          range.setEnd(node, end);
        } else {
          range.selectNodeContents(node);
        }
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) { console.warn('[oz] selectText failed', e); }
      if (a.holdMs) await sleep(a.holdMs, ctx.signal);
    },

    async highlight(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      const pad = a.padding != null ? a.padding : 6;
      ctx.spotlight.show(el, pad);
      if (a.holdMs) await sleep(a.holdMs, ctx.signal);
      if (a.hideAfter !== false) ctx.spotlight.hide();
    },

    async pulse(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = a.padding != null ? a.padding : 4;
      const node = document.createElement('div');
      node.className = 'oz-pulse';
      node.style.left = (r.left - pad) + 'px';
      node.style.top = (r.top - pad) + 'px';
      node.style.width = (r.width + pad * 2) + 'px';
      node.style.height = (r.height + pad * 2) + 'px';
      document.body.appendChild(node);
      const dur = a.duration != null ? a.duration : 1400;
      try { await sleep(dur, ctx.signal); } finally { node.remove(); }
    },

    async pan(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      const cam = ctx.camera.cameraToCenter(el, a.zoom != null ? a.zoom : ctx.camera.s);
      await ctx.camera.animateTo(cam.s, cam.tx, cam.ty, {
        duration: a.duration, easing: a.easing, signal: ctx.signal
      });
    },

    async setZoom(a, ctx) {
      const target = ctx.scene && ctx.scene.target ? resolveEl(ctx.scene.target) : null;
      if (!target) return;
      const cam = ctx.camera.cameraToCenter(target, a.zoom);
      await ctx.camera.animateTo(cam.s, cam.tx, cam.ty, { duration: a.duration, signal: ctx.signal });
    },

    async say(a, ctx) {
      if (ctx.hud) ctx.hud.update({
        title: a.title != null ? a.title : ctx.scene.title,
        caption: a.caption != null ? a.caption : ctx.scene.caption,
        current: ctx.sceneIndex, total: ctx.sceneCount
      });
      if (a.holdMs) await sleep(a.holdMs, ctx.signal);
    },

    async comment(a, ctx) {
      const el = resolveEl(a.selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const node = document.createElement('div');
      node.className = 'oz-comment';
      let html = '';
      if (a.title) html += '<p class="oz-comment-title"></p>';
      if (a.text || a.body) html += '<p class="oz-comment-body"></p>';
      if (a.html) html += a.html;
      node.innerHTML = html;
      if (a.title) node.querySelector('.oz-comment-title').textContent = a.title;
      if (a.text || a.body) node.querySelector('.oz-comment-body').textContent = a.text || a.body;
      document.body.appendChild(node);

      // position bubble
      const margin = 12;
      const bubble = node.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      let pos = a.position;
      if (!pos) {
        if (r.top - bubble.height - margin > 8) pos = 'top';
        else if (vh - r.bottom - bubble.height - margin > 8) pos = 'bottom';
        else if (r.left - bubble.width - margin > 8) pos = 'left';
        else pos = 'right';
      }
      let left, top;
      if (pos === 'top') {
        left = r.left + r.width / 2 - bubble.width / 2;
        top = r.top - bubble.height - margin;
      } else if (pos === 'bottom') {
        left = r.left + r.width / 2 - bubble.width / 2;
        top = r.bottom + margin;
      } else if (pos === 'left') {
        left = r.left - bubble.width - margin;
        top = r.top + r.height / 2 - bubble.height / 2;
      } else {
        left = r.right + margin;
        top = r.top + r.height / 2 - bubble.height / 2;
      }
      // clamp into viewport
      left = clamp(left, 8, vw - bubble.width - 8);
      top = clamp(top, 8, vh - bubble.height - 8);
      node.style.left = left + 'px';
      node.style.top = top + 'px';
      node.dataset.pos = pos;
      // arrow position relative to bubble
      const targetCenterX = r.left + r.width / 2;
      const arrow = clamp(targetCenterX - left, 16, bubble.width - 16);
      node.style.setProperty('--oz-arrow', arrow + 'px');

      ctx.tour._comments.push(node);
      requestAnimationFrame(() => node.classList.add('oz-on'));
      if (a.holdMs) await sleep(a.holdMs, ctx.signal);
    },

    async clearComments(a, ctx) {
      ctx.tour._clearComments();
      if (a && a.holdMs) await sleep(a.holdMs, ctx.signal);
    },

    async custom(a, ctx) {
      if (typeof a.fn === 'function') await a.fn(ctx);
    }
  };

  async function runActions(actions, ctx) {
    if (!actions || !actions.length) return;
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (ctx.signal.aborted) throw new DOMException('aborted', 'AbortError');
      const fn = ACTIONS[action.type];
      if (!fn) { console.warn('[oz] unknown action:', action.type); continue; }
      try { await fn(action, ctx); }
      catch (e) {
        if (e && e.name === 'AbortError') throw e;
        console.warn('[oz] action failed', action, e);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Tour orchestrator
  // -----------------------------------------------------------------------
  class Tour {
    constructor(opts) {
      drainPendingLocales();
      this.opts = deepMerge(DEFAULTS, opts || {});
      this.opts.locale = resolveLocale(this.opts.locale);
      this.scenes = this.opts.scenes || [];
      this.idx = -1;
      this.active = false;
      this._listeners = {};
      this._abort = null;
      this._stage = null;
      this._stageOwnsBody = false;
      this._scrollPos = { x: 0, y: 0 };
      this._keyHandler = null;
      this._resizeHandler = null;
      this._dim = null;
      this._comments = [];
      this._snapshots = null;
      this._appliedThemeProps = null;

      // autoStart: kick off on DOMReady regardless of past runs.
      // runOnce:   kick off on DOMReady only if storage flag isn't set.
      if (this.opts.autoStart || this.opts.runOnce) {
        const launch = () => {
          if (this.opts.runOnce) {
            try {
              if (localStorage.getItem(this.opts.storageKey) === '1') return;
            } catch (e) {}
          }
          setTimeout(() => this.start(), this.opts.autoStartDelay || 0);
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', launch, { once: true });
        } else {
          launch();
        }
      }
    }

    _applyTheme() {
      const theme = this.opts.theme;
      if (!theme) return;
      const resolved = (typeof theme === 'string') ? THEMES[theme] : theme;
      if (!resolved || typeof resolved !== 'object') return;
      const root = document.documentElement;
      this._appliedThemeProps = [];
      Object.keys(resolved).forEach(key => {
        const prop = '--oz-' + camelToKebab(key);
        // Save any pre-existing inline value so we can restore exactly.
        const prev = root.style.getPropertyValue(prop);
        this._appliedThemeProps.push({ prop, prev });
        root.style.setProperty(prop, resolved[key]);
      });
    }

    /**
     * Switch HUD locale at runtime. Accepts:
     *   - string code: 'ru', 'es', etc. (must be registered via locales/*.js)
     *   - object: partial or full locale; missing keys fall back to English
     * Safe to call any time (before or during the tour). Re-renders HUD chrome live.
     * Note: scene titles/captions are user content — site owner must swap scenes
     *       separately if those need translating too.
     */
    setLocale(localeOrCode) {
      this.opts.locale = resolveLocale(localeOrCode);
      if (this.hud) this.hud.refreshLocale();
    }

    _setupLocaleSync() {
      if (this.opts.watchHtmlLang) {
        const tryApply = () => {
          const lang = document.documentElement.lang;
          if (!lang) return;
          if (LOCALES[lang]) { this.setLocale(lang); return; }
          const base = lang.split('-')[0];
          if (LOCALES[base]) this.setLocale(base);
        };
        tryApply();
        this._langObserver = new MutationObserver(tryApply);
        this._langObserver.observe(document.documentElement, {
          attributes: true, attributeFilter: ['lang']
        });
      }
      if (this.opts.localeEventName) {
        this._localeEvtName = this.opts.localeEventName;
        this._localeEvtHandler = (e) => {
          const detail = e && e.detail;
          if (detail) this.setLocale(detail);
        };
        document.addEventListener(this._localeEvtName, this._localeEvtHandler);
      }
    }

    _teardownLocaleSync() {
      if (this._langObserver) { this._langObserver.disconnect(); this._langObserver = null; }
      if (this._localeEvtName && this._localeEvtHandler) {
        document.removeEventListener(this._localeEvtName, this._localeEvtHandler);
        this._localeEvtHandler = null;
        this._localeEvtName = null;
      }
    }

    /**
     * Cap a desired zoom level so the target element doesn't overflow the viewport.
     * - Returns the smaller of: requested zoom, max-zoom-that-fits.
     * - Never goes below 1× (we don't want forced zoom-out).
     * - Skipped if fitToViewport is disabled globally or scene.noFit is true.
     * - Skipped on keepZoom scenes (caller's intent is to preserve current scale).
     */
    _fitZoom(targetEl, requestedZoom, scene) {
      if (this.opts.fitToViewport === false) return requestedZoom;
      if (scene && scene.noFit) return requestedZoom;
      if (scene && scene.keepZoom) return requestedZoom;
      // Layout box of the target — independent of any current camera transform.
      const w = targetEl.offsetWidth;
      const h = targetEl.offsetHeight;
      if (!w || !h) return requestedZoom;
      const ratio = (scene && scene.fitRatio != null)
        ? scene.fitRatio
        : (this.opts.viewportFitRatio != null ? this.opts.viewportFitRatio : 0.92);
      const maxZoomW = (window.innerWidth  * ratio) / w;
      const maxZoomH = (window.innerHeight * ratio) / h;
      const maxZoom = Math.min(maxZoomW, maxZoomH);
      // Cap to maxZoom but stay at >= 1.0
      return Math.max(1, Math.min(requestedZoom, maxZoom));
    }

    _clearTheme() {
      if (!this._appliedThemeProps) return;
      const root = document.documentElement;
      this._appliedThemeProps.forEach(({ prop, prev }) => {
        if (prev) root.style.setProperty(prop, prev);
        else root.style.removeProperty(prop);
      });
      this._appliedThemeProps = null;
    }

    on(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); return this; }
    off(evt, fn) { if (this._listeners[evt]) this._listeners[evt] = this._listeners[evt].filter(f => f !== fn); }
    _emit(evt) {
      const args = Array.prototype.slice.call(arguments, 1);
      (this._listeners[evt] || []).forEach(fn => { try { fn.apply(null, args); } catch (e) { console.error(e); } });
      const k = 'on' + evt.charAt(0).toUpperCase() + evt.slice(1);
      const cb = this.opts[k];
      if (typeof cb === 'function') { try { cb.apply(null, args); } catch (e) { console.error(e); } }
    }

    canRun() {
      const reason = shouldDisable(this.opts);
      if (reason) return { ok: false, reason };
      if (this.opts.rememberDismiss) {
        try { if (localStorage.getItem(this.opts.storageKey) === '1') return { ok: false, reason: 'dismissed' }; } catch (e) {}
      }
      if (!this.scenes || !this.scenes.length) return { ok: false, reason: 'noScenes' };
      return { ok: true };
    }

    async start() {
      if (this.active) return false;
      const can = this.canRun();
      if (!can.ok) {
        if (typeof console !== 'undefined') console.info('[oz] tour skipped:', can.reason);
        return false;
      }
      this.active = true;
      this._abort = new AbortController();
      this._applyTheme();
      this._setupStage();
      this._setupOverlays();
      this._setupHandlers();
      this._setupLocaleSync();
      this._emit('start');
      this.idx = -1;
      await this._goto(0);
      return true;
    }

    _setupStage() {
      injectStyles(STYLES, 'oz-styles');
      this._scrollPos = { x: window.scrollX, y: window.scrollY };
      if (this.opts.lockScroll) {
        document.documentElement.classList.add('oz-locked');
      }

      const rootSel = this.opts.cameraRoot;
      let root = (typeof rootSel === 'string') ? document.querySelector(rootSel) : rootSel;
      if (!root) root = document.body;

      if (root === document.body) {
        // Wrap body children into a stage div, excluding fixed/sticky/listed elements.
        const stage = document.createElement('div');
        stage.className = 'oz-stage';
        const exclude = new Set();
        (this.opts.excludeFromCamera || []).forEach(s => {
          document.querySelectorAll(s).forEach(el => exclude.add(el));
        });
        const kids = Array.from(document.body.children).filter(el => {
          if (exclude.has(el)) return false;
          if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT' || el.tagName === 'LINK') return false;
          if (el.classList && (el.classList.contains('oz-cursor') || el.classList.contains('oz-hud') ||
              el.classList.contains('oz-spotlight') || el.classList.contains('oz-dim') ||
              el.classList.contains('oz-pulse') || el.classList.contains('oz-stage'))) return false;
          if (el.hasAttribute && el.hasAttribute('data-oz-stay')) return false;
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.position === 'sticky') return false;
          return true;
        });
        kids.forEach(k => stage.appendChild(k));
        document.body.insertBefore(stage, document.body.firstChild);
        this._stage = stage;
        this._stageOwnsBody = true;
      } else {
        root.classList.add('oz-stage');
        this._stage = root;
        this._stageOwnsBody = false;
      }

      this.camera = new Camera(this._stage, this.opts.transitionMs);
      this.cursor = this.opts.showCursor ? new Cursor() : null;
      this.spotlight = new Spotlight();
      this.hud = this.opts.showControls ? new HUD(this) : null;

      // Snapshot innerHTML now (after stage is built but before any scene runs).
      this._captureSnapshot();
    }

    _captureSnapshot() {
      if (!this.opts.revertOnEnd && !this.opts.snapshotTargets) return;
      this._snapshots = [];
      const targets = (this.opts.snapshotTargets && this.opts.snapshotTargets.length)
        ? this.opts.snapshotTargets.map(resolveEl).filter(Boolean)
        : [this._stage];
      targets.forEach(el => this._snapshots.push({ el, html: el.innerHTML }));
    }

    _restoreSnapshot() {
      if (!this._snapshots) return;
      // Clear text selection (snapshot replaces nodes; old selection becomes invalid).
      try { window.getSelection().removeAllRanges(); } catch (e) {}
      this._snapshots.forEach(s => {
        if (s.el && s.el.isConnected) s.el.innerHTML = s.html;
      });
      this._snapshots = null;
    }

    _setupOverlays() {
      if (this.opts.showDim) {
        const dim = document.createElement('div');
        dim.className = 'oz-dim';
        document.body.appendChild(dim);
        this._dim = dim;
        requestAnimationFrame(() => dim.classList.add('oz-on'));
      }
      if (this.hud) requestAnimationFrame(() => this.hud.show());
      if (this.cursor) this.cursor.show();
    }

    _setupHandlers() {
      this._keyHandler = (e) => {
        if (!this.active) return;
        if (e.key === 'Escape' && this.opts.closeOnEsc) { e.preventDefault(); this.skip(); }
        if (this.opts.keyboardNav) {
          if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
          if (e.key === 'ArrowLeft')  { e.preventDefault(); this.prev(); }
        }
      };
      window.addEventListener('keydown', this._keyHandler);
      let resizeRaf = null;
      this._resizeHandler = () => {
        if (!this.active || this.idx < 0) return;
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          const scene = this.scenes[this.idx];
          const t = resolveEl(scene && scene.target);
          if (!t) return;
          const raw = scene.keepZoom ? this.camera.s : (scene.zoom != null ? scene.zoom : this.opts.initialZoom);
          const z = this._fitZoom(t, raw, scene);
          const cam = this.camera.cameraToCenter(t, z);
          this.camera.set(cam.s, cam.tx, cam.ty);
        });
      };
      window.addEventListener('resize', this._resizeHandler);
    }

    _clearComments() {
      this._comments.forEach(el => {
        el.classList.remove('oz-on');
        setTimeout(() => el.remove(), 220);
      });
      this._comments = [];
    }

    async _goto(i, opts) {
      opts = opts || {};
      if (i >= this.scenes.length) return this._end(false);
      if (i < 0) return;

      // abort any running scene
      if (this._abort) this._abort.abort();
      this._abort = new AbortController();
      // clean comment bubbles and spotlight from previous scene
      this._clearComments();
      if (this.spotlight) this.spotlight.hide();

      const wentForward = i > this.idx;
      const fast = !!opts.fast;
      const fastFactor = this.opts.fastFactor != null ? this.opts.fastFactor : 0.45;
      this.idx = i;
      const scene = this.scenes[i];
      this._emit('sceneEnter', scene, i);

      if (this.hud) this.hud.update({
        title: scene.title, caption: scene.caption,
        current: i, total: this.scenes.length
      });

      const target = resolveEl(scene.target);
      if (!target) console.warn('[oz] scene target not found:', scene.target);

      if (target) {
        // keepZoom: true reuses the camera's current scale (pure pan, no scale change).
        const rawZoom = scene.keepZoom
          ? this.camera.s
          : (scene.zoom != null ? scene.zoom : this.opts.initialZoom);
        // If fit-to-viewport is on, cap the zoom so the target stays inside the viewport.
        // We never go BELOW 1× (no unnecessary zoom-out). On narrow screens this means
        // the camera just pans into place without making content overflow horizontally.
        const desiredZoom = this._fitZoom(target, rawZoom, scene);
        const baseMs = scene.transitionMs != null ? scene.transitionMs : this.opts.transitionMs;
        const camMs = fast ? Math.max(180, baseMs * fastFactor) : baseMs;

        // optional zoom-out interlude between scenes (skipped on fast manual nav)
        if (this.opts.interscene === 'zoomOut' && wentForward && this.camera.s > 1 && !fast) {
          const interZoom = Math.max(0.85, this.opts.interscenePadding * Math.min(this.camera.s, desiredZoom));
          const interCam = this.camera.cameraToCenter(target, interZoom);
          await this.camera.animateTo(interCam.s, interCam.tx, interCam.ty, {
            duration: baseMs * 0.55,
            easing: 'easeInOutCubic',
            signal: this._abort.signal
          }).catch(e => { if (e && e.name !== 'AbortError') throw e; });
        }

        const cam = this.camera.cameraToCenter(target, desiredZoom);
        await this.camera.animateTo(cam.s, cam.tx, cam.ty, {
          duration: camMs,
          easing: scene.easing || (fast ? 'easeOutCubic' : 'easeInOutCubic'),
          signal: this._abort.signal
        }).catch(e => { if (e && e.name !== 'AbortError') throw e; });
      }

      if (this.cursor && target && scene.placeCursor !== false) {
        const r = target.getBoundingClientRect();
        this.cursor.place(r.left + r.width / 2, r.top + r.height / 2);
      }

      try {
        await runActions(scene.actions, {
          camera: this.camera,
          cursor: this.cursor,
          spotlight: this.spotlight,
          hud: this.hud,
          scene: scene,
          sceneIndex: i,
          sceneCount: this.scenes.length,
          tour: this,
          signal: this._abort.signal
        });
      } catch (e) {
        if (e && e.name !== 'AbortError') console.error('[oz] scene actions error', e);
        else return; // aborted -> caller has already moved on
      }

      this._emit('sceneExit', scene, i);

      if (scene.autoAdvance && this.active && this.idx === i) {
        await sleep(scene.autoAdvanceDelay != null ? scene.autoAdvanceDelay : 800, this._abort.signal).catch(() => {});
        // auto-advance keeps the cinematic (non-fast) speed
        if (this.active && this.idx === i) this._goto(i + 1);
      }
    }

    next() {
      if (!this.active) return;
      if (this.idx >= this.scenes.length - 1) return this._end(false);
      this._goto(this.idx + 1, { fast: true });
    }
    prev() {
      if (!this.active || this.idx <= 0) return;
      this._goto(this.idx - 1, { fast: true });
    }
    goto(i) { if (this.active) this._goto(i, { fast: true }); }

    skip() {
      if (this.opts.rememberDismiss) {
        try { localStorage.setItem(this.opts.storageKey, '1'); } catch (e) {}
      }
      this._emit('skip');
      this._end(true);
    }

    _end(skipped) {
      if (!this.active) return;
      this.active = false;
      if (this._abort) this._abort.abort();

      if (this.hud) this.hud.hide();
      if (this.cursor) this.cursor.hide();
      if (this.spotlight) this.spotlight.hide();
      if (this._dim) this._dim.classList.remove('oz-on');

      const finish = () => this._teardown(skipped);
      if (this.camera) {
        this.camera.animateTo(1, 0, 0, { duration: this.opts.transitionMs, easing: 'easeInOutCubic' })
          .then(finish, finish);
      } else {
        finish();
      }
    }

    _teardown(skipped) {
      if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
      if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
      this._clearComments();
      this._teardownLocaleSync();
      // Restore DOM BEFORE we unwrap the stage so snapshotted children come back clean.
      this._restoreSnapshot();
      if (this._stageOwnsBody && this._stage) {
        const parent = this._stage.parentNode;
        while (this._stage.firstChild) parent.insertBefore(this._stage.firstChild, this._stage);
        this._stage.remove();
      } else if (this._stage) {
        this._stage.style.transform = '';
        this._stage.classList.remove('oz-stage');
      }
      if (this.cursor) this.cursor.destroy();
      if (this.spotlight) this.spotlight.destroy();
      if (this.hud) this.hud.destroy();
      if (this._dim) setTimeout(() => this._dim && this._dim.remove(), 320);
      if (this.opts.lockScroll) {
        document.documentElement.classList.remove('oz-locked');
        try { window.scrollTo(this._scrollPos.x, this._scrollPos.y); } catch (e) {}
      }
      this._clearTheme();
      // runOnce: persist the flag whether the tour was completed naturally or skipped.
      if (this.opts.runOnce) {
        try { localStorage.setItem(this.opts.storageKey, '1'); } catch (e) {}
      }
      this._emit('end', { skipped: !!skipped });
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  return {
    version: VERSION,
    create(opts) { return new Tour(opts); },
    canRun(opts) { return new Tour(opts || {}).canRun(); },
    registerAction(name, fn) { ACTIONS[name] = fn; },
    // Clear the runOnce / rememberDismiss flag so the tour can be auto-shown again.
    resetSeen(storageKey) {
      try { localStorage.removeItem(storageKey || 'oz_tour_dismissed'); } catch (e) {}
    },
    // Read whether the current visitor has already completed/dismissed the tour.
    hasSeen(storageKey) {
      try { return localStorage.getItem(storageKey || 'oz_tour_dismissed') === '1'; }
      catch (e) { return false; }
    },
    themes: THEMES,
    locales: LOCALES,             // mutable map; locale files (locales/*.js) write into it
    easings: easings
  };
}));
