"use strict";
var VFindMode = {
  isActive: false,
  query: "",
  parsedQuery: "",
  historyIndex: 0,
  isRegex: false,
  ignoreCase: false,
  hasNoIgnoreCaseFlag: false,
  hasResults: false,
  matchCount: 0,
  scrollX: 0,
  scrollY: 0,
  initialRange: null,
  activeRegexIndex: 0,
  regexMatches: null,
  box: null,
  input: null,
  countEl: null,
  styleIn: null,
  styleOut: null,
  returnToViewport: false,
  A0Re: /\xa0/g,
  cssSel: "::selection{background:#ff9632;}",
  cssOut: "body{-webkit-user-select:auto !important;user-select:auto !important}\n",
  cssIFrame: '*{font:12px/14px "Helvetica Neue",Helvetica,Arial,sans-serif !important;\
height:14px;margin:0;overflow:hidden;vertical-align:top;white-space:nowrap;cursor:default;}\
body{cursor:text;display:inline-block;padding:0 3px 0 1px;max-width:215px;min-width:7px;}\
body *{cursor:text;display:inline;}body br{display:none;}\
html > span{float:right;}',
  activate: function(options) {
    if (!VDom.isHTML()) { return false; }
    options = Object.setPrototypeOf(options || {}, null);
    var query = options.query, zoom;
    this.isActive || query === this.query || VMarks.setPreviousPosition();
    if (query != null) {
      return this.findAndFocus(this.query || query, options);
    }
    this.getCurrentRange();
    if (options.returnToViewport) {
      this.returnToViewport = true;
      this.scrollX = window.scrollX;
      this.scrollY = window.scrollY;
    }
    this.box && VDom.UI.adjust();
    if (this.isActive) {
      this.box.contentWindow.focus();
      this.input.focus();
      this.box.contentDocument.execCommand("selectAll", false);
      return;
    }

    zoom = VDom.UI.getZoom();
    this.parsedQuery = this.query = "";
    this.regexMatches = null;
    this.activeRegexIndex = 0;
    this.init && this.init();
    this.styleIn.disabled = this.styleOut.disabled = true;

    var el = this.box = VDom.createElement("iframe");
    el.className = "R HUD UI";
    el.style.width = "0px";
    zoom !== 1 && (el.style.zoom = 1 / zoom);
    el.onload = function() { VFindMode.onLoad(this); };
    VDom.UI.addElement(el, {adjust: true, before: VHUD.box});
  },
  onLoad: function(el) {
    var wnd = el.contentWindow, doc = wnd.document, docEl = doc.documentElement, zoom;
    el.onload = null;
    wnd.onmousedown = el.onmousedown = this.OnMousedown;
    wnd.onkeydown = this.onKeydown.bind(this);
    wnd.onfocus = VEventMode.OnWndFocus();
    wnd.onunload = this.OnUnload;
    zoom = wnd.devicePixelRatio;
    zoom < 1 && (docEl.style.zoom = 1 / zoom);
    doc.head.appendChild(VDom.UI.createStyle(VFindMode.cssIFrame, doc));
    el = this.input = doc.body;
    docEl.insertBefore(doc.createTextNode("/"), el);
    el.contentEditable = "plaintext-only";
    el.oninput = this.onInput.bind(this);
    el = this.countEl = doc.createElement("span");
    el.appendChild(doc.createTextNode(""));
    setTimeout(function() { docEl.appendChild(el); }, 0, el);
    VDom.UI.focus(this.input);
    this.isActive = true;
  },
  init: function() {
    var ref = this.postMode, UI = VDom.UI;
    ref.exit = ref.exit.bind(ref);
    UI.addElement(this.styleIn = UI.createStyle(this.cssSel));
    UI.box.appendChild(this.styleOut = UI.createStyle(this.cssOut + this.cssSel));
    this.init = null;
  },
  findAndFocus: function(query, options) {
    if (query !== this.query) {
      this.updateQuery(query);
      if (this.isActive) {
        this.input.textContent = query.replace(/^ /, '\xa0');
        this.showCount();
      }
    }
    this.init && this.init();
    var style = this.isActive || VHUD.opacity !== 1 ? null : VHUD.box.style;
    style && (style.visibility = "hidden");
    this.execute(null, options);
    style && (style.visibility = "");
    if (!this.hasResults) {
      this.isActive || VHUD.showForDuration("No matches for '" + this.query + "'", 1000);
      return;
    }
    this.focusFoundLink(window.getSelection().anchorNode);
    this.postMode.activate();
  },
  deactivate: function(unexpectly) { // need keep @hasResults
    this.checkReturnToViewPort();
    this.isActive = this.returnToViewport = this._small = false;
    if (unexpectly !== true) {
      window.focus();
      var el = VDom.getSelectionFocusElement();
      el && el.focus && el.focus();
    }
    this.box.remove();
    if (this.box === VDom.lastHovered) { VDom.lastHovered = null; }
    this.box = this.input = this.countEl = null;
    this.styleIn.disabled = true;
    this.parsedQuery = this.query = "";
    this.initialRange = this.regexMatches = null;
    this.historyIndex = this.matchCount = this.scrollY = this.scrollX = 0;
    return el;
  },
  OnUnload: function() { var f = VFindMode; f && f.isActive && f.deactivate(true); },
  OnMousedown: function(event) { if (event.target !== VFindMode.input) { event.preventDefault(); VFindMode.input.focus(); } },
  onKeydown: function(event) {
    var i = event.keyCode, n = i, el, el2;
    i = event.altKey ? 0 : i === VKeyCodes.enter ? (this.saveQuery(), 2)
      : (i === VKeyCodes.backspace || i === VKeyCodes.deleteKey) ? +!this.query.length
      : 0;
    if (!i) {
      if (VKeyboard.isEscape(event)) { i = 3; }
      else if (i = VKeyboard.getKeyStat(event)) {
        if ((i & ~6) !== 0 || n < 74 || n > 75) { return; }
        this.execute(null, { dir: 74 - n });
        i = 0;
      }
      else if (n === VKeyCodes.f1) { this.box.contentDocument.execCommand("delete"); }
      else if (n === VKeyCodes.f1 + 1) { window.focus(); VEventMode.suppress(n); }
      else if (n === VKeyCodes.up || n === VKeyCodes.down) { this.nextQuery(n === VKeyCodes.up ? 1 : -1); }
      else { return; }
    }
    VUtils.Prevent(event);
    if (!i) { return; }
    var hasStyle = !this.styleIn.disabled;
    el = this.deactivate();
    VEventMode.suppress(n);
    if ((i === 3 || !this.hasResults || VVisualMode.mode) && hasStyle) {
      this.toggleStyle(0);
      this.restoreSelection(true);
    }
    if (VVisualMode.mode) { return VVisualMode.activate(); }
    if (i < 2 || !this.hasResults) { return; }
    if (!el || el !== VEventMode.lock()) {
      el = window.getSelection().anchorNode;
      if (el && !this.focusFoundLink(el) && i === 3 && (el2 = document.activeElement)) {
        VDom.getEditableType(el2) === 3 && el.contains(el2) && VDom.UI.simulateSelect(el2);
      }
    }
    i === 2 && this.postMode.activate();
  },
  focusFoundLink: function(el) {
    for (; el && el !== document.body; el = el.parentElement) {
      if (el instanceof HTMLAnchorElement) {
        el.focus();
        return true;
      }
    }
  },
  nextQuery: function(dir) {
    var ind = this.historyIndex + dir;
    if (ind < 0) { return; }
    this.historyIndex = ind;
    if (dir < 0) {
      this.box.contentDocument.execCommand("undo", false);
      this.box.contentWindow.getSelection().collapseToEnd();
      return;
    }
    VPort.send({ handler: "findQuery", index: ind }, this.SetQuery);
  },
  SetQuery: function(query) {
    var _this = VFindMode, doc;
    if (query === _this.query) { return; }
    if (!query && _this.historyIndex > 0) { --_this.historyIndex; return; }
    (doc = _this.box.contentDocument).execCommand("selectAll", false);
    doc.execCommand("insertText", false, query.replace(/^ /, '\xa0'));
    _this.onInput();
  },
  saveQuery: function() {
    this.query && VPort.post({ handler: "findQuery", query: this.query });
  },
  postMode: {
    lock: null,
    activate: function() {
      var el = VEventMode.lock(), Exit = this.exit;
      if (!el) { Exit(); return; }
      VHandler.push(this.onKeydown, this);
      if (el === this.lock) { return; }
      if (!this.lock) {
        addEventListener("click", Exit, true);
        VEventMode.setupSuppress(Exit);
      }
      Exit(true);
      this.lock = el;
      el.addEventListener("blur", Exit, true);
    },
    onKeydown: function(event) {
      var exit = VKeyboard.isEscape(event);
      exit ? this.exit() : VHandler.remove(this);
      return 2 * exit;
    },
    exit: function(skip) {
      if (skip instanceof MouseEvent && skip.isTrusted === false) { return; }
      this.lock && this.lock.removeEventListener("blur", this.exit, true);
      if (!this.lock || skip === true) { return; }
      this.lock = null;
      removeEventListener("click", this.exit, true);
      VHandler.remove(this);
      VEventMode.setupSuppress();
    }
  },
  onInput: function() {
    var query = this.input.textContent.replace(this.A0Re, " ");
    this.checkReturnToViewPort();
    this.updateQuery(query);
    this.restoreSelection();
    this.execute(!this.isRegex ? this.parsedQuery : this.regexMatches ? this.regexMatches[0] : "");
    this.showCount();
  },
  _small: false,
  showCount: function() {
    var count = this.matchCount;
    this.countEl.firstChild.data = !this.parsedQuery ? ""
      : "(" + (count || (this.hasResults ? "Some" : "No")) + " match" + (count !== 1 ? "es)" : ")");
    count = this.input.offsetWidth + this.countEl.offsetWidth + 4;
    if (this._small && count < 150) { return; }
    this.box.style.width = ((this._small = count < 150) ? 0 : count) + "px";
  },
  checkReturnToViewPort: function() {
    this.returnToViewport && window.scrollTo(this.scrollX, this.scrollY);
  },
  _ctrlRe: /(\\\\?)([rRI]?)/g,
  escapeAllRe: /[$()*+.?\[\\\]\^{|}]/g,
  updateQuery: function(query) {
    this.query = query;
    this.isRegex = VSettings.cache.regexFindMode;
    this.hasNoIgnoreCaseFlag = false;
    query = this.parsedQuery = query.replace(this._ctrlRe, this.FormatQuery);
    this.ignoreCase = !this.hasNoIgnoreCaseFlag && !VUtils.hasUpperCase(query);
    this.isRegex || (query = this.isActive && query.replace(this.escapeAllRe, "\\$&"));

    var re, matches;
    if (query) {
      try { re = new RegExp(query, this.ignoreCase ? "gi" : "g"); } catch (e) {}
    }
    matches = re && (document.webkitFullscreenElement || document.documentElement).innerText.match(re);
    this.regexMatches = this.isRegex && matches || null;
    this.activeRegexIndex = 0;
    this.matchCount = matches ? matches.length : 0;
  },
  FormatQuery: function(match, slashes, flag) {
    if (!flag || slashes.length != 1) { return match; }
    if (flag === 'I') { VFindMode.hasNoIgnoreCaseFlag = true; }
    else { VFindMode.isRegex = flag === 'r'; }
    return "";
  },
  restoreSelection: function(isCur) {
    var sel = window.getSelection(), range;
    range = !isCur ? this.initialRange : sel.isCollapsed ? null : sel.getRangeAt(0);
    if (!range) { return; }
    sel.removeAllRanges();
    sel.addRange(range);
  },
  getNextQueryFromRegexMatches: function(dir) {
    if (!this.regexMatches) { return ""; }
    var count = this.matchCount;
    this.activeRegexIndex = count = (this.activeRegexIndex + dir + count) % count;
    return this.regexMatches[count];
  },
  execute: function(query, options) {
    Object.setPrototypeOf(options || (options = {}), null);
    var el, found, count = options.count | 0, dir = options.dir || 1, q;
    options.noColor || this.toggleStyle(1);
    do {
      q = query != null ? query : this.isRegex ? this.getNextQueryFromRegexMatches(dir) : this.parsedQuery;
      found = window.find(q, options.caseSensitive || !this.ignoreCase, dir < 0, true, false, true, false);
    } while (0 < --count && found);
    options.noColor || setTimeout(this.hookSel.bind(this, "add"), 0);
    (el = VEventMode.lock()) && !VDom.isSelected(document.activeElement) && el.blur();
    this.hasResults = found;
  },
  RestoreHighlight: function() { VFindMode.toggleStyle(0); },
  hookSel: function(action) { document[action + "EventListener"]("selectionchange", this.RestoreHighlight, true); },
  toggleStyle: function(enabled) {
    this.hookSel("remove");
    this.styleOut.disabled = this.styleIn.disabled = !enabled;
  },
  getCurrentRange: function() {
    var sel = window.getSelection(), range;
    if (sel.type == "None") {
      range = document.createRange();
      range.setStart(document.body || document.documentElement, 0);
    } else {
      range = sel.getRangeAt(0);
    }
    range.setEnd(range.startContainer, range.startOffset);
    this.initialRange = range;
  }
};
