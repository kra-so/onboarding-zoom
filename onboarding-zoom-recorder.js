/*!
 * onboarding-zoom-recorder v0.1.0
 * Author tool for non-developers — click elements to build tours, export as JSON.
 *
 * REQUIRES: onboarding-zoom.js to be loaded first.
 *
 * SECURITY NOTE: this script enables anyone to author tours on the page.
 * In production, only serve it to authenticated admin users — gate inclusion
 * server-side. Never bundle into your public runtime.
 *
 * Quick start:
 *   const rec = OnboardingZoom.recorder();
 *   rec.start();        // shows panel, enables click-to-add-scene
 *   rec.preview();      // play back what's recorded so far
 *   rec.export();       // returns JSON string
 *   rec.stop();         // hides UI; scenes kept in memory
 */
(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    factory();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const w = (typeof window !== 'undefined') ? window : null;
  if (!w) return null;
  if (!w.OnboardingZoom) {
    console.warn('[oz-recorder] OnboardingZoom must be loaded before the recorder.');
    return null;
  }

  const VERSION = '0.1.0';

  // ---- styles ---------------------------------------------------------
  const STYLES = `
    .ozr-outline {
      position: fixed; pointer-events: none; z-index: 2147483600;
      border: 2px dashed rgba(99, 102, 241, 0.95);
      background: rgba(99, 102, 241, 0.10);
      border-radius: 6px;
      transition: all 80ms ease-out;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.05);
    }
    .ozr-outline-label {
      position: absolute; top: -22px; left: 0;
      background: rgba(99, 102, 241, 0.95); color: white;
      font: 11px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2px 6px; border-radius: 4px;
      white-space: nowrap; max-width: 240px;
      overflow: hidden; text-overflow: ellipsis;
    }
    .ozr-banner {
      position: fixed; top: 14px; left: 50%;
      transform: translateX(-50%);
      background: rgba(99, 102, 241, 0.95);
      color: white;
      padding: 8px 16px; border-radius: 999px;
      font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
      z-index: 2147483601;
      pointer-events: none;
      animation: ozr-pulse 2s ease-in-out infinite;
    }
    @keyframes ozr-pulse {
      0%, 100% { box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4); }
      50%      { box-shadow: 0 8px 24px rgba(99, 102, 241, 0.7); }
    }
    .ozr-toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(8px);
      background: rgba(20, 22, 38, 0.96); color: white;
      padding: 10px 16px; border-radius: 10px;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 2147483602;
      opacity: 0;
      transition: opacity 200ms ease, transform 240ms cubic-bezier(.2,.8,.2,1);
    }
    .ozr-toast.is-on { opacity: 1; transform: translateX(-50%) translateY(0); }
    .ozr-panel {
      position: fixed; right: 14px; bottom: 14px;
      width: min(340px, calc(100vw - 28px));
      max-height: calc(100vh - 28px);
      background: rgba(20, 22, 38, 0.97); color: white;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column;
      z-index: 2147483599;
      box-sizing: border-box;
    }
    .ozr-panel * { box-sizing: border-box; }
    .ozr-panel-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 14px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    .ozr-panel-title { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .ozr-panel-title-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #6b7080;
    }
    .ozr-panel.is-recording .ozr-panel-title-dot {
      background: #ef4444; animation: ozr-pulse 1s ease-in-out infinite;
    }
    .ozr-icon-btn {
      appearance: none; border: 0; background: transparent; cursor: pointer;
      color: rgba(255,255,255,0.6);
      padding: 4px; border-radius: 4px;
      width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
      transition: color 120ms, background 120ms;
    }
    .ozr-icon-btn:hover { color: white; background: rgba(255,255,255,0.08); }
    .ozr-panel-body {
      flex: 1 1 auto; overflow-y: auto; padding: 12px 14px;
    }
    .ozr-empty {
      text-align: center; color: rgba(255,255,255,0.55); padding: 24px 8px; font-size: 13px;
    }
    .ozr-scene {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; padding: 10px; margin-bottom: 8px;
    }
    .ozr-scene-head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
    }
    .ozr-scene-num {
      background: rgba(99,102,241,0.85); color: white;
      width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600;
    }
    .ozr-scene-sel {
      flex: 1 1 auto;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
      font-size: 11px; color: rgba(255,255,255,0.65);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ozr-scene input,
    .ozr-scene textarea,
    .ozr-scene select {
      width: 100%; box-sizing: border-box;
      background: rgba(0,0,0,0.25); color: white;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 6px 8px;
      font: inherit; font-size: 13px;
      margin-bottom: 6px;
      resize: vertical;
    }
    .ozr-scene textarea { min-height: 38px; max-height: 80px; }
    .ozr-scene-zoom-row {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
      font-size: 12px; color: rgba(255,255,255,0.65);
    }
    .ozr-scene-zoom-row input[type="range"] { flex: 1; margin: 0; padding: 0; height: 18px; }
    .ozr-scene-zoom-val { font-family: ui-monospace, monospace; min-width: 32px; text-align: right; }
    .ozr-actions { margin-top: 6px; }
    .ozr-actions-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      color: rgba(255,255,255,0.45); margin-bottom: 4px;
    }
    .ozr-action {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 6px; background: rgba(0,0,0,0.2); border-radius: 4px;
      font-size: 11px; margin-bottom: 4px;
    }
    .ozr-action-type {
      color: #a5b4fc; font-family: ui-monospace, monospace;
    }
    .ozr-action-info { flex: 1; color: rgba(255,255,255,0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ozr-action-del {
      cursor: pointer; color: rgba(255,255,255,0.4); font-size: 14px;
      padding: 0 4px; line-height: 1;
    }
    .ozr-action-del:hover { color: #ef4444; }
    .ozr-add-action {
      width: 100%;
      background: rgba(99,102,241,0.15); color: #a5b4fc;
      border: 1px dashed rgba(99,102,241,0.5);
      border-radius: 6px; padding: 5px 8px;
      font: inherit; font-size: 12px; cursor: pointer;
      margin-top: 4px;
    }
    .ozr-add-action:hover { background: rgba(99,102,241,0.25); color: white; }
    .ozr-panel-foot {
      padding: 10px 14px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; gap: 6px; flex-wrap: wrap;
      flex-shrink: 0;
    }
    .ozr-btn {
      appearance: none; border: 0; cursor: pointer;
      background: rgba(255,255,255,0.08);
      color: white;
      padding: 7px 12px; border-radius: 6px;
      font: inherit; font-size: 12px; font-weight: 500;
      transition: background 120ms;
    }
    .ozr-btn:hover { background: rgba(255,255,255,0.16); }
    .ozr-btn-primary { background: rgba(99,102,241,0.85); }
    .ozr-btn-primary:hover { background: rgba(99,102,241,1); }
    .ozr-btn-danger:hover { background: rgba(239, 68, 68, 0.7); }
    .ozr-modal {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483610;
      padding: 24px;
    }
    .ozr-modal-card {
      background: rgba(20,22,38,0.98); color: white;
      border-radius: 14px; padding: 18px;
      max-width: 720px; width: 100%; max-height: calc(100vh - 48px);
      display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }
    .ozr-modal-head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .ozr-modal h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .ozr-modal textarea {
      flex: 1; min-height: 280px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: rgba(0,0,0,0.35); color: white;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; padding: 12px;
      resize: vertical;
    }
    .ozr-modal-foot {
      margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;
    }
    .ozr-validate {
      margin-top: 8px; padding: 8px 10px; border-radius: 6px;
      font-size: 12px;
    }
    .ozr-validate.ok { background: rgba(34, 197, 94, 0.15); color: #86efac; }
    .ozr-validate.err { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }

    /* Action picker dropdown */
    .ozr-action-menu {
      position: fixed;
      background: rgba(20, 22, 38, 0.98);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
      padding: 4px;
      z-index: 2147483605;
      min-width: 240px;
      max-width: 320px;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 140ms ease, transform 180ms cubic-bezier(.2,.8,.2,1);
    }
    .ozr-action-menu.is-on { opacity: 1; transform: translateY(0); }
    .ozr-menu-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%;
      appearance: none; border: 0; background: transparent;
      color: white;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      font: inherit; font-size: 13px;
      text-align: left;
      transition: background 80ms;
    }
    .ozr-menu-item:hover { background: rgba(99, 102, 241, 0.22); }
    .ozr-menu-item:focus-visible { background: rgba(99, 102, 241, 0.22); outline: 0; }
    .ozr-menu-icon {
      font-size: 13px; width: 22px; height: 22px;
      flex-shrink: 0; opacity: 0.85;
      display: inline-flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.06); border-radius: 5px;
    }
    .ozr-menu-text {
      display: flex; flex-direction: column; flex: 1; min-width: 0;
    }
    .ozr-menu-label { font-weight: 500; line-height: 1.25; }
    .ozr-menu-desc {
      font-size: 11px; color: rgba(255, 255, 255, 0.55);
      margin-top: 1px; line-height: 1.3;
    }
    .ozr-menu-form { padding: 10px; }
    .ozr-menu-form-head {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    }
    .ozr-menu-form-head .ozr-menu-icon { width: 20px; height: 20px; }
    .ozr-menu-form-head-title { font-weight: 600; font-size: 13px; }
    .ozr-menu-form label {
      display: block; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.5px; color: rgba(255, 255, 255, 0.55);
      margin-bottom: 4px; margin-top: 8px; font-weight: 600;
    }
    .ozr-menu-form input,
    .ozr-menu-form select {
      width: 100%; box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3); color: white;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 6px 8px;
      font: inherit; font-size: 13px;
    }
    .ozr-menu-form input:focus,
    .ozr-menu-form select:focus {
      outline: 0; border-color: rgba(99, 102, 241, 0.7);
    }
    .ozr-menu-form-buttons {
      display: flex; gap: 6px; justify-content: flex-end;
      margin-top: 12px;
    }
  `;

  function injectStyles() {
    if (document.getElementById('ozr-styles')) return;
    const s = document.createElement('style');
    s.id = 'ozr-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // Generate a robust selector for an element. Order: id → data-tour-id →
  // unique class → nth-of-type path. Skips brittle dynamic class fragments.
  function getSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return '#' + el.id;
    if (el.dataset && el.dataset.tourId) return '[data-tour-id="' + el.dataset.tourId + '"]';
    if (el.dataset && el.dataset.testid) return '[data-testid="' + el.dataset.testid + '"]';
    // unique class
    if (typeof el.className === 'string' && el.className) {
      const classes = el.className.split(/\s+/).filter(c => c && /^[a-zA-Z][\w-]*$/.test(c));
      for (let i = 0; i < classes.length; i++) {
        const sel = '.' + classes[i];
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }
    // nth-of-type path up to body or to the first ancestor with id
    const path = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[a-zA-Z][\w-]*$/.test(cur.id)) {
        path.unshift('#' + cur.id);
        return path.join(' > ');
      }
      const parent = cur.parentNode;
      if (parent) {
        const sib = Array.prototype.filter.call(parent.children, c => c.tagName === cur.tagName);
        if (sib.length > 1) {
          const idx = Array.prototype.indexOf.call(sib, cur) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }
      path.unshift(part);
      cur = cur.parentNode;
    }
    return path.join(' > ');
  }

  // Detect whether an element is part of any onboarding-zoom UI overlay
  // (recorder panel, runtime HUD, spotlight, etc.) — those should never become
  // recording targets.
  function isOzUI(el) {
    while (el && el.nodeType === 1) {
      const cls = el.className;
      if (typeof cls === 'string' && /\b(ozr-|oz-(cursor|hud|dim|spotlight|pulse|comment|stage))/.test(cls)) {
        return true;
      }
      if (el.id === 'ozr-panel' || el.id === 'ozr-modal') return true;
      el = el.parentNode;
    }
    return false;
  }

  // Default action types the recorder offers when adding to a scene.
  // `needs`: 'text' | 'number' | 'comment' (multi-field) | undefined (no input → add immediately)
  const ACTION_PRESETS = [
    { type: 'highlight', icon: '▣', label: 'Highlight target',
      desc: 'Outlined frame around the element with backdrop dim',
      defaults: { holdMs: 600 } },
    { type: 'pulse',     icon: '◎', label: 'Pulse target',
      desc: 'Pulsing ring animation that fades out',
      defaults: { duration: 900 } },
    { type: 'comment',   icon: '💬', label: 'Comment bubble',
      desc: 'Tooltip pinned to the element with arrow',
      defaults: { text: 'Edit me', position: 'top' },
      needs: 'comment' },
    { type: 'click',     icon: '👆', label: 'Click target',
      desc: 'Move the cursor and animate a click (visual only)',
      defaults: { dispatch: false, afterMs: 300 } },
    { type: 'wait',      icon: '⏱', label: 'Wait (ms)',
      desc: 'Pause the tour for a moment',
      defaults: { ms: 500 },
      needs: 'number' }
  ];

  // ---- Recorder -------------------------------------------------------
  class Recorder {
    constructor(opts) {
      this.opts = opts || {};
      this.scenes = [];
      this.recording = false;
      this._panel = null;
      this._outline = null;
      this._toast = null;
      this._toastTimeout = null;
      this._mouseHandler = null;
      this._clickHandler = null;
      this._keyHandler = null;
    }

    /** Show the recorder UI and enable click-to-add. */
    start() {
      if (this.recording) return this;
      injectStyles();
      this._buildPanel();
      this._buildOutline();
      this._enableInteraction();
      this.recording = true;
      this._panel.classList.add('is-recording');
      this._showBanner();
      return this;
    }

    /** Hide the UI. Recorded scenes stay in memory. */
    stop() {
      if (!this.recording) return this;
      this._disableInteraction();
      if (this._outline) this._outline.remove(), this._outline = null;
      if (this._banner) this._banner.remove(), this._banner = null;
      if (this._panel) this._panel.remove(), this._panel = null;
      this.recording = false;
      return this;
    }

    /** Run the recorded tour without leaving recorder mode. */
    preview() {
      if (!this.scenes.length) {
        this._showToast('Nothing to preview yet — click an element first.');
        return null;
      }
      // Hide recorder UI during preview, restore after
      const wasOpen = !!this._panel;
      if (this._panel) this._panel.style.display = 'none';
      if (this._outline) this._outline.style.display = 'none';
      if (this._banner) this._banner.style.display = 'none';

      const tour = w.OnboardingZoom.create({
        scenes: this._exportScenes(),
        excludeFromCamera: ['.ozr-panel', '.ozr-banner', '.ozr-outline', '.ozr-toast', '.ozr-modal']
          .concat(this.opts.excludeFromCamera || [])
      });
      tour.on('end', () => {
        if (wasOpen && this._panel) this._panel.style.display = '';
        if (this._outline) this._outline.style.display = '';
        if (this._banner) this._banner.style.display = '';
      });
      tour.start();
      return tour;
    }

    /** Return scenes + version-tagged JSON ready for export. */
    toJSON() {
      return {
        version: w.OnboardingZoom.jsonVersion || 1,
        scenes: this._exportScenes()
      };
    }

    /** Pretty-print JSON string. */
    export() { return JSON.stringify(this.toJSON(), null, 2); }

    /** Trigger a download of tour.json. */
    download(filename) {
      const blob = new Blob([this.export()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'tour.json';
      // Mark with ozr-* class so the recorder's capture-phase click handler
      // skips this synthetic click — otherwise it'd preventDefault() the
      // download AND record the temporary <a> as a new scene.
      a.className = 'ozr-internal';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Wipe all scenes. */
    clear() {
      this.scenes = [];
      this._renderPanel();
    }

    /** Programmatic add — useful for hydrating from existing JSON. */
    addScene(target, options) {
      options = options || {};
      const sel = (typeof target === 'string') ? target : getSelector(target);
      if (!sel) return null;
      const scene = {
        target: sel,
        title: options.title || ('Step ' + (this.scenes.length + 1)),
        caption: options.caption != null ? options.caption : '',
        zoom: options.zoom != null ? options.zoom : 1.5,
        actions: options.actions || [
          { type: 'highlight', selector: sel, holdMs: 600 }
        ]
      };
      this.scenes.push(scene);
      this._renderPanel();
      return scene;
    }

    // ---- internals --------------------------------------------------

    _exportScenes() {
      // Scene already in proper shape — just clone defensively.
      return JSON.parse(JSON.stringify(this.scenes));
    }

    _buildPanel() {
      const p = document.createElement('div');
      p.className = 'ozr-panel';
      p.id = 'ozr-panel';
      p.innerHTML =
        '<div class="ozr-panel-head">' +
          '<div class="ozr-panel-title"><span class="ozr-panel-title-dot"></span><span>Tour Recorder</span></div>' +
          '<button class="ozr-icon-btn" data-act="close" aria-label="Close">' +
            '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="ozr-panel-body" id="ozr-body"></div>' +
        '<div class="ozr-panel-foot">' +
          '<button class="ozr-btn" data-act="preview">▶ Preview</button>' +
          '<button class="ozr-btn ozr-btn-primary" data-act="export">Export JSON</button>' +
          '<button class="ozr-btn ozr-btn-danger" data-act="clear" style="margin-left:auto">Clear</button>' +
        '</div>';
      document.body.appendChild(p);
      this._panel = p;

      p.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        if (act === 'close') this.stop();
        else if (act === 'preview') this.preview();
        else if (act === 'export') this._openExportModal();
        else if (act === 'clear') {
          if (this.scenes.length && !confirm('Discard all scenes?')) return;
          this.clear();
        }
      });

      this._renderPanel();
    }

    _renderPanel() {
      if (!this._panel) return;
      const body = this._panel.querySelector('#ozr-body');
      body.innerHTML = '';
      if (!this.scenes.length) {
        const empty = document.createElement('div');
        empty.className = 'ozr-empty';
        empty.textContent = 'Click any element on the page to add it as a scene.';
        body.appendChild(empty);
        return;
      }
      this.scenes.forEach((scene, idx) => body.appendChild(this._renderScene(scene, idx)));
    }

    _renderScene(scene, idx) {
      const card = document.createElement('div');
      card.className = 'ozr-scene';
      card.innerHTML =
        '<div class="ozr-scene-head">' +
          '<span class="ozr-scene-num">' + (idx + 1) + '</span>' +
          '<span class="ozr-scene-sel" title="' + scene.target.replace(/"/g, '&quot;') + '">' + scene.target + '</span>' +
          '<button class="ozr-icon-btn" data-act="up" aria-label="Move up">▲</button>' +
          '<button class="ozr-icon-btn" data-act="down" aria-label="Move down">▼</button>' +
          '<button class="ozr-icon-btn" data-act="del" aria-label="Delete">✕</button>' +
        '</div>' +
        '<input type="text" data-field="title" value="' + (scene.title || '').replace(/"/g, '&quot;') + '" placeholder="Title">' +
        '<textarea data-field="caption" placeholder="Caption (one paragraph)">' + (scene.caption || '') + '</textarea>' +
        '<div class="ozr-scene-zoom-row">' +
          '<span>Zoom</span>' +
          '<input type="range" data-field="zoom" min="1" max="3" step="0.1" value="' + (scene.zoom || 1.5) + '">' +
          '<span class="ozr-scene-zoom-val">' + (scene.zoom || 1.5).toFixed(1) + '×</span>' +
        '</div>' +
        '<div class="ozr-actions"><div class="ozr-actions-label">Actions</div></div>';

      // actions list
      const actionsEl = card.querySelector('.ozr-actions');
      (scene.actions || []).forEach((a, ai) => {
        const row = document.createElement('div');
        row.className = 'ozr-action';
        row.innerHTML =
          '<span class="ozr-action-type">' + a.type + '</span>' +
          '<span class="ozr-action-info">' + this._actionInfo(a) + '</span>' +
          '<span class="ozr-action-del" data-act="del-action" data-idx="' + ai + '">✕</span>';
        actionsEl.appendChild(row);
      });
      const addBtn = document.createElement('button');
      addBtn.className = 'ozr-add-action';
      addBtn.setAttribute('data-act', 'add-action');
      addBtn.textContent = '+ Add action';
      actionsEl.appendChild(addBtn);

      // bind events
      card.addEventListener('input', (e) => {
        const field = e.target.getAttribute && e.target.getAttribute('data-field');
        if (!field) return;
        let val = e.target.value;
        if (field === 'zoom') {
          val = parseFloat(val);
          card.querySelector('.ozr-scene-zoom-val').textContent = val.toFixed(1) + '×';
        }
        scene[field] = val;
      });
      card.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        if (act === 'del') {
          this.scenes.splice(idx, 1);
          this._renderPanel();
        } else if (act === 'up' && idx > 0) {
          [this.scenes[idx - 1], this.scenes[idx]] = [this.scenes[idx], this.scenes[idx - 1]];
          this._renderPanel();
        } else if (act === 'down' && idx < this.scenes.length - 1) {
          [this.scenes[idx + 1], this.scenes[idx]] = [this.scenes[idx], this.scenes[idx + 1]];
          this._renderPanel();
        } else if (act === 'del-action') {
          const ai = parseInt(t.getAttribute('data-idx'), 10);
          scene.actions.splice(ai, 1);
          this._renderPanel();
        } else if (act === 'add-action') {
          this._openActionMenu(scene, t);
        }
      });
      return card;
    }

    _actionInfo(a) {
      if (a.type === 'comment') return '"' + (a.text || '').slice(0, 30) + '"';
      if (a.type === 'wait') return (a.ms || 0) + ' ms';
      if (a.type === 'highlight' || a.type === 'pulse' || a.type === 'click') return a.selector ? '→ ' + a.selector.slice(0, 24) : '';
      return '';
    }

    _openActionMenu(scene, anchor) {
      // Close any other menu that may be open.
      document.querySelectorAll('.ozr-action-menu').forEach(m => m.remove());

      const menu = document.createElement('div');
      menu.className = 'ozr-action-menu';
      ACTION_PRESETS.forEach(preset => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ozr-menu-item';
        item.innerHTML =
          '<span class="ozr-menu-icon">' + preset.icon + '</span>' +
          '<span class="ozr-menu-text">' +
            '<span class="ozr-menu-label">' + preset.label + '</span>' +
            '<span class="ozr-menu-desc">' + preset.desc + '</span>' +
          '</span>';
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this._handleActionPick(scene, preset, menu);
        });
        menu.appendChild(item);
      });
      this._positionMenuAbove(menu, anchor);
      document.body.appendChild(menu);
      requestAnimationFrame(() => menu.classList.add('is-on'));

      // Close on outside click / Escape.
      const closeFn = (e) => {
        if (e.type === 'keydown' && e.key !== 'Escape') return;
        if (e.type === 'click' && menu.contains(e.target)) return;
        if (e.type === 'click' && e.target === anchor) return;
        menu.remove();
        document.removeEventListener('click', closeFn, true);
        document.removeEventListener('keydown', closeFn);
      };
      // Defer attachment so the very click that opened us doesn't close it.
      setTimeout(() => {
        document.addEventListener('click', closeFn, true);
        document.addEventListener('keydown', closeFn);
      }, 0);
    }

    _positionMenuAbove(menu, anchor) {
      const r = anchor.getBoundingClientRect();
      // Render off-screen first to measure
      menu.style.visibility = 'hidden';
      menu.style.left = '-9999px';
      menu.style.top = '0';
      document.body.appendChild(menu);
      const mh = menu.offsetHeight;
      const mw = menu.offsetWidth;
      menu.remove();
      // Decide above or below
      const spaceAbove = r.top;
      const spaceBelow = window.innerHeight - r.bottom;
      let top;
      if (spaceAbove >= mh + 8 || spaceAbove > spaceBelow) {
        top = Math.max(8, r.top - mh - 6);
      } else {
        top = Math.min(window.innerHeight - mh - 8, r.bottom + 6);
      }
      let left = r.left;
      if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
      if (left < 8) left = 8;
      menu.style.visibility = '';
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
    }

    _handleActionPick(scene, preset, menu) {
      const need = preset.needs;
      if (!need) {
        // No input required — add immediately and close.
        this._commitAction(scene, preset, {});
        menu.remove();
        return;
      }
      // Replace menu content with an inline form.
      menu.innerHTML = '';
      const form = document.createElement('div');
      form.className = 'ozr-menu-form';
      let formHtml =
        '<div class="ozr-menu-form-head">' +
          '<span class="ozr-menu-icon">' + preset.icon + '</span>' +
          '<span class="ozr-menu-form-head-title">' + preset.label + '</span>' +
        '</div>';
      if (need === 'comment') {
        formHtml +=
          '<label>Text</label>' +
          '<input type="text" data-field="text" value="' + (preset.defaults.text || '').replace(/"/g, '&quot;') + '">' +
          '<label>Position</label>' +
          '<select data-field="position">' +
            '<option value="top">top</option>' +
            '<option value="bottom">bottom</option>' +
            '<option value="left">left</option>' +
            '<option value="right">right</option>' +
          '</select>';
      } else if (need === 'text') {
        formHtml +=
          '<label>Text</label>' +
          '<input type="text" data-field="text" value="' + (preset.defaults.text || '').replace(/"/g, '&quot;') + '">';
      } else if (need === 'number') {
        formHtml +=
          '<label>Milliseconds</label>' +
          '<input type="number" min="0" step="50" data-field="ms" value="' + (preset.defaults.ms || 500) + '">';
      }
      formHtml +=
        '<div class="ozr-menu-form-buttons">' +
          '<button type="button" class="ozr-btn" data-act="cancel">Cancel</button>' +
          '<button type="button" class="ozr-btn ozr-btn-primary" data-act="add">Add</button>' +
        '</div>';
      form.innerHTML = formHtml;
      menu.appendChild(form);

      // Set selected position default
      const positionEl = form.querySelector('select[data-field="position"]');
      if (positionEl) positionEl.value = preset.defaults.position || 'top';

      // Focus the first input
      const firstInput = form.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }

      const collect = () => {
        const data = {};
        form.querySelectorAll('[data-field]').forEach(f => {
          const k = f.getAttribute('data-field');
          let v = f.value;
          if (f.type === 'number') v = parseInt(v, 10) || 0;
          data[k] = v;
        });
        return data;
      };

      form.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        if (act === 'cancel') menu.remove();
        else if (act === 'add') {
          this._commitAction(scene, preset, collect());
          menu.remove();
        }
      });
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { menu.remove(); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          this._commitAction(scene, preset, collect());
          menu.remove();
        }
      });
    }

    _commitAction(scene, preset, fieldOverrides) {
      const action = Object.assign(
        { type: preset.type, selector: scene.target },
        preset.defaults,
        fieldOverrides
      );
      scene.actions = scene.actions || [];
      scene.actions.push(action);
      this._renderPanel();
    }

    _buildOutline() {
      const el = document.createElement('div');
      el.className = 'ozr-outline';
      el.style.display = 'none';
      el.innerHTML = '<div class="ozr-outline-label">selector</div>';
      document.body.appendChild(el);
      this._outline = el;
    }

    _showBanner() {
      const b = document.createElement('div');
      b.className = 'ozr-banner';
      b.textContent = '🎬 Recording — click any element to add it as a scene';
      document.body.appendChild(b);
      this._banner = b;
    }

    _showToast(msg) {
      if (this._toast) {
        this._toast.remove();
        clearTimeout(this._toastTimeout);
      }
      const t = document.createElement('div');
      t.className = 'ozr-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      this._toast = t;
      requestAnimationFrame(() => t.classList.add('is-on'));
      this._toastTimeout = setTimeout(() => {
        t.classList.remove('is-on');
        setTimeout(() => t.remove(), 240);
      }, 2200);
    }

    _enableInteraction() {
      this._mouseHandler = (e) => {
        if (!this.recording) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || isOzUI(el)) {
          this._outline.style.display = 'none';
          return;
        }
        const r = el.getBoundingClientRect();
        const sel = getSelector(el);
        this._outline.style.display = 'block';
        this._outline.style.left = r.left + 'px';
        this._outline.style.top = r.top + 'px';
        this._outline.style.width = r.width + 'px';
        this._outline.style.height = r.height + 'px';
        this._outline.querySelector('.ozr-outline-label').textContent = sel;
      };
      this._clickHandler = (e) => {
        if (!this.recording) return;
        if (isOzUI(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.target;
        const sel = getSelector(el);
        if (!sel) return;
        this.addScene(sel);
        this._showToast('Scene ' + this.scenes.length + ' added: ' + (sel.length > 32 ? sel.slice(0, 32) + '…' : sel));
      };
      this._keyHandler = (e) => {
        if (!this.recording) return;
        if (e.key === 'Escape') this.stop();
      };
      document.addEventListener('mousemove', this._mouseHandler);
      document.addEventListener('click', this._clickHandler, true); // capture
      document.addEventListener('keydown', this._keyHandler);
    }

    _disableInteraction() {
      if (this._mouseHandler) document.removeEventListener('mousemove', this._mouseHandler);
      if (this._clickHandler) document.removeEventListener('click', this._clickHandler, true);
      if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    }

    _openExportModal() {
      const json = this.export();
      const validation = w.OnboardingZoom.validate ? w.OnboardingZoom.validate(json) : null;
      const modal = document.createElement('div');
      modal.className = 'ozr-modal';
      modal.id = 'ozr-modal';
      modal.innerHTML =
        '<div class="ozr-modal-card">' +
          '<div class="ozr-modal-head">' +
            '<h3>Tour JSON</h3>' +
            '<button class="ozr-icon-btn" data-act="close" aria-label="Close">' +
              '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>' +
            '</button>' +
          '</div>' +
          '<textarea readonly>' + json.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</textarea>' +
          (validation
            ? '<div class="ozr-validate ' + (validation.ok ? 'ok' : 'err') + '">' +
                (validation.ok ? '✓ Valid' : '✗ ' + validation.errors.join('; ')) +
                (validation.warnings && validation.warnings.length ? ' · ' + validation.warnings.length + ' warning(s)' : '') +
              '</div>'
            : '') +
          '<div class="ozr-modal-foot">' +
            '<button class="ozr-btn" data-act="copy">Copy to clipboard</button>' +
            '<button class="ozr-btn" data-act="download">Download tour.json</button>' +
            '<button class="ozr-btn ozr-btn-primary" data-act="close">Close</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.addEventListener('click', (e) => {
        if (e.target === modal) return close();
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const act = t.getAttribute('data-act');
        if (act === 'close') close();
        else if (act === 'copy') {
          modal.querySelector('textarea').select();
          try {
            const ok = document.execCommand && document.execCommand('copy');
            if (!ok && navigator.clipboard) navigator.clipboard.writeText(json);
            this._showToast('JSON copied');
          } catch (e) { this._showToast('Copy failed — select and Cmd+C'); }
        } else if (act === 'download') {
          this.download();
        }
      });
    }
  }

  // Attach to OnboardingZoom global
  w.OnboardingZoom.recorder = function (opts) { return new Recorder(opts); };
  w.OnboardingZoom.Recorder = Recorder;
  w.OnboardingZoom.recorderVersion = VERSION;

  return Recorder;
}));
