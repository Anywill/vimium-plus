"use strict";
var Vomnibar = {
  activate: function(options) {
    var url, keyword, search, start;
    if (!this.init && VPort.EnsurePort()) { return; }
    Object.setPrototypeOf(options = options || {}, null);
    this.mode.type = this.modeType = options.mode || "omni";
    this.forceNewTab = options.force ? true : false;
    url = options.url;
    keyword = options.keyword;
    this.mode.clientWidth = options.width;
    if (url == null) {
      return this.reset(keyword ? keyword + " " : "");
    }
    if (search = options.search) {
      start = search.start;
      url = search.url;
      keyword || (keyword = search.keyword);
    } else if (search === null) {
      url = VUtils.decodeURL(url).replace(/\s$/g, "%20");
    } else {
      url = VUtils.decodeURL(url, decodeURIComponent).trim().replace(/\s+/g, " ");
    }
    if (keyword) {
      start = (start || 0) + keyword.length + 1;
      return this.reset(keyword + " " + url, start, start + url.length);
    } else {
      return this.reset(url);
    }
  },

  isActive: false,
  inputText: "",
  lastQuery: "",
  modeType: "",
  useInput: true,
  completions: null,
  isEditing: false,
  isHttps: false,
  isSearchOnTop: false,
  actionType: 0,
  matchType: 0,
  focused: true,
  forceNewTab: false,
  showFavIcon: false,
  showRelevancy: false,
  isScrolling: 0,
  height: 0,
  input: null,
  isSelectionOrigin: true,
  lastKey: 0,
  list: null,
  onUpdate: null,
  doEnter: null,
  refreshInterval: 500,
  wheelInterval: 100,
  renderItems: null,
  selection: -1,
  timer: 0,
  wheelTimer: 0,
  show: function() {
    var zoom = 1 / window.devicePixelRatio;
    document.body.style.zoom = zoom > 1 ? zoom : "";
    this.focused || setTimeout(function() { Vomnibar.input.focus(); }, 50);
    addEventListener("mousewheel", this.onWheel, {passive: false});
    this.input.value = this.inputText;
    setTimeout(function() { Vomnibar.input.onselect = Vomnibar.OnSelect; }, 120);
  },
  hide: function(data) {
    this.isActive = this.isEditing = false;
    this.height = this.matchType = 0;
    window.removeEventListener("mousewheel", this.onWheel, {passive: false});
    window.onkeyup = null;
    this.input.onselect = null;
    this.completions = this.onUpdate = null;
    this.modeType = this.mode.type = this.mode.query = this.lastQuery = this.inputText = "";
    if (data === "hide") { return this.onHidden(); }
    this.timer > 0 && clearTimeout(this.timer);
    this.timer = setTimeout(this.onHidden.bind(this), 100);
    VPort.postToOwner({name: "hide", waitFrame: this.doEnter ? 1 : 0});
  },
  onHidden: function() {
    clearTimeout(this.timer);
    VPort.postMessage({ handler: "refocusCurrent", lastKey: this.lastKey });
    this.doEnter && setTimeout(this.doEnter, 0);
    this.input.blur();
    this.input.value = "";
    this.list.textContent = "";
    this.list.classList.remove("withList");
    this.timer = this.lastKey = 0;
    /a?/.test("");
  },
  reset: function(input, start, end) {
    this.inputText = input || (input = "");
    this.useInput = false;
    this.mode.query = this.lastQuery = input.trim().replace(this._spacesRe, " ");
    // also clear @timer
    this.update(0, input && start <= end ? function() {
      this.show();
      this.input.setSelectionRange(start, end);
    } : this.show);
    this.isActive && (this.height = -1);
    this.isActive = true;
    return this.init && this.init();
  },
  update: function(updateDelay, callback) {
    this.onUpdate = callback || null;
    if (typeof updateDelay === "number") {
      if (this.timer > 0) {
        clearTimeout(this.timer);
      }
      if (updateDelay <= 0) {
        return this.filter();
      }
    } else if (this.timer > 0) {
      return;
    } else {
      updateDelay = this.refreshInterval;
    }
    this.timer = setTimeout(this.OnTimer, updateDelay);
  },
  refresh: function() {
    var oldSel = this.selection, origin = this.isSelectionOrigin;
    this.useInput = false;
    this.mode.clientWidth = window.innerWidth;
    this.update(17, function() {
      var len = this.completions.length;
      if (!origin && oldSel >= 0 && len > 0) {
        oldSel = Math.min(oldSel, len - 1);
        this.selection = 0; this.isSelectionOrigin = false;
        this.updateSelection(oldSel);
      }
      this.focused || this.input.focus();
    });
  },
  updateInput: function(sel) {
    var focused = this.focused, line, str;
    this.isSelectionOrigin = false;
    if (sel === -1) {
      this.isHttps = this.isEditing = false;
      this.input.value = this.inputText;
      if (!focused) { this.input.focus(); this.focused = false; }
      return;
    }
    if (!focused) this.input.blur();
    line = this.completions[sel];
    str = line.text;
    line.https == null && (line.https = line.url.startsWith("https://"));
    if (line.type !== "history" && line.type !== "tab") {
      this._updateInput(line, str);
      if (line.type === "math") {
        this.input.select();
      }
      return;
    }
    if (line.parsed) {
      return this._updateInput(line, line.parsed);
    }
    if (line.url.toLowerCase().startsWith("http") && str.lastIndexOf("://", 5) < 0) {
      str = (line.url[5] === ':' ? "http://" : "https://") + str;
    }
    VPort.sendMessage({
      handler: "parseSearchUrl",
      url: str
    }, function(search) {
      line.parsed = search ? search.keyword + " " + search.url : line.text;
      if (sel === Vomnibar.selection) {
        return Vomnibar._updateInput(line, line.parsed);
      }
    });
  },
  toggleInput: function() {
    if (this.selection < 0) { return; }
    if (this.isSelectionOrigin) {
      this.inputText = this.input.value;
      return this.updateInput(this.selection);
    }
    var line = this.completions[this.selection], str = this.input.value.trim();
    str = str === line.url ? (line.parsed || line.text)
      : str === line.text ? line.url : line.text;
    return this._updateInput(line, str);
  },
  _updateInput: function(line, str) {
    this.input.value = str;
    this.isHttps = line.https && str === line.text;
    this.isEditing = str !== line.parsed || line.parsed === line.text;
  },
  updateSelection: function(sel) {
    if (this.timer) { return; }
    var _ref = this.list.children, old = this.selection;
    (this.isSelectionOrigin || old < 0) && (this.inputText = this.input.value);
    this.updateInput(sel);
    this.selection = sel;
    old >= 0 && _ref[old].classList.remove("s");
    sel >= 0 && _ref[sel].classList.add("s");
  },
  ctrlMap: {
    66: "pageup", 74: "down", 75: "up", 219: "dismiss", 221: "toggle"
    , 78: "down", 80: "up"
  },
  normalMap: {
    9: "down", 27: "dismiss", 33: "pageup", 34: "pagedown", 38: "up", 40: "down"
    , 112: "backspace", 113: "blur"
  },
  onKeydown: function(event) {
    if (!this.isActive) { return 2; }
    var action = "", n = event.keyCode, focused = this.focused;
    this.lastKey = n;
    if (event.altKey || event.metaKey) {
      if (event.ctrlKey || event.shiftKey) {}
      else if (n === 113) {
        this.onAction(focused ? "blurInput" : "focus");
        return 2;
      }
      else if (!focused) {}
      else if (n >= 66 && n <= 70 && n !== 67 || n === 8) {
        this.onBashAction(n - 64);
        return 2;
      }
      if (event.altKey) { return 0; }
    }
    if (n === 13) {
      window.onkeyup = this.onEnterUp;
      return 2;
    }
    else if (event.ctrlKey || event.metaKey) {
      if (event.shiftKey) { action = n === 70 ? "pagedown" : n === 66 ? "pageup" : ""; }
      else if (n === 38 || n === 40) {
        VPort.postToOwner({ name: "scrollBy", amount: n - 39 });
        this.isScrolling = Date.now();
        window.onkeyup = Vomnibar.handleKeydown;
        return 2;
      }
      else { action = this.ctrlMap[n] || ""; }
    }
    else if (event.shiftKey) {
      action = n === 38 ? "pageup" : n === 40 ? "pagedown" : n === 9 ? "up" : "";
    }
    else if (action = this.normalMap[n] || "") {}
    else if (n === 229) { return 0; }
    else if (n === 8) { return focused ? 1 : 2; }
    else if (n !== 32) {}
    else if (!focused) { action = "focus"; }
    else if ((this.selection >= 0
        || this.completions.length <= 1) && this.input.value.endsWith("  ")) {
      action = "enter";
    }
    if (action) {
      this.onAction(action);
      return 2;
    }

    if (n <= 32) {}
    else if (n > 112 && n <= 123) { focused = false; }
    else if (!focused && n >= 48 && n < 58) {
      n = (n - 48) || 10;
      if (event.shiftKey || n > this.completions.length) { return 2; }
      this.onEnter(event, n - 1);
      return 2;
    }
    return focused && n !== 93 ? 1 : 0;
  },
  onAction: function(action) {
    var sel, selection, el;
    switch(action) {
    case "dismiss":
      selection = window.getSelection();
      if (selection.type === "Range" && this.focused) {
        el = this.input;
        sel = el.selectionDirection !== "backward" &&
          el.selectionEnd < el.value.length ? el.selectionStart : el.selectionEnd;
        el.setSelectionRange(sel, sel);
      } else {
        this.hide();
      }
      break;
    case "focus": this.input.focus(); break;
    case "blurInput": this.input.blur(); break;
    case "backspace": case "blur":
      !this.focused ? this.input.focus()
      : action === "blur" ? VPort.postMessage({ handler: "refocusCurrent", lastKey: this.lastKey })
      : document.execCommand("delete");
      break;
    case "up": case "down":
      sel = this.completions.length + 1;
      sel = (sel + this.selection + (action === "up" ? 0 : 2)) % sel - 1;
      this.updateSelection(sel);
      break;
    case "toggle": this.toggleInput(); break;
    case "pageup": case "pagedown": this.goPage(action === "pageup" ? -1 : 1); break;
    case "enter": this.onEnter(true); break;
    default: break;
    }
  },
  onBashAction: function(code) {
    var sel = window.getSelection(), isExtend = code === 4 || code < 0;
    sel.collapseToStart();
    sel.modify(isExtend ? "extend" : "move", code < 4 ? "backward" : "forward", "word");
    isExtend && sel.type === "Range" && document.execCommand("delete");
  },
  _pageNumRe: /(?:^|\s)(\+\d{0,2})$/,
  goPage: function(sel) {
    var i, arr, len = this.completions.length,
    n = this.mode.maxResults,
    str = len ? this.completions[0].type : "";
    if (this.isSearchOnTop) { return; }
    str = (this.isSelectionOrigin || this.selection < 0 ? this.input.value : this.inputText).trimRight();
    arr = this._pageNumRe.exec(str);
    i = (arr && arr[0]) | 0;
    if (len >= n) { sel *= n; }
    else if (i > 0 && sel < 0) { sel *= i >= n ? n : 1; }
    else if (len < (len && this.completions[0].type === "tab" ? 3 : n)) { return; }

    sel += i;
    sel = sel < 0 ? 0 : sel > 90 ? 90 : sel;
    if (sel == i) { return; }
    if (arr) { str = str.substring(0, str.length - arr[0].length); }
    str = str.trimRight();
    i = Math.min(this.input.selectionEnd, str.length);
    if (sel > 0) { str += " +" + sel; }
    sel = this.input.selectionStart;
    arr = [this.input.selectionDirection];
    this.input.value = str;
    this.input.setSelectionRange(sel, i, arr[0]);
    this.update();
  },
  onEnter: function(event, newSel) {
    var sel = newSel != null ? newSel : this.selection, item, func;
    this.actionType = event == null ? this.actionType : event === true ? -this.forceNewTab
      : event.ctrlKey || event.metaKey ? -1 - event.shiftKey
      : event.shiftKey ? 0 : -this.forceNewTab;
    if (newSel != null) {}
    else if (sel === -1 && this.input.value.length === 0) { return; }
    else if (!this.timer) {}
    else if (this.isEditing) { sel = -1; }
    else if (sel === -1 || this.isSelectionOrigin) {
      this.update(0, this.onEnter);
      return;
    }
    item = sel >= 0 ? this.completions[sel] : { url: this.input.value.trim() };
    func = function() {
      Vomnibar.doEnter = null;
      item.hasOwnProperty('sessionId') ? Vomnibar.gotoSession(item) : Vomnibar.navigateToUrl(item);
    };
    if (this.actionType < -1) { func(); return; }
    this.doEnter = func;
    this.hide();
  },
  onEnterUp: function(event) {
    if (event.keyCode === 13) {
      Vomnibar.lastKey = 0;
      window.onkeyup = null;
      Vomnibar.onEnter(event);
    }
  },
  onClick: function(event) {
    var el = event.target;
    if (el === this.input || window.getSelection().type === "Range") { return; }
    else if (el === this.input.parentElement) { this.onAction("focus"); return; }
    while(el && el.parentNode !== this.list) { el = el.parentNode; }
    if (!el) { return; }
    if (this.timer) { event.preventDefault(); return; }
    this.lastKey = 0;
    this.onEnter(event, [].indexOf.call(this.list.children, el));
  },
  OnMenu: function (event) {
    for (var _i, el = event.target; el; el = el.parentElement) {
      if (el.classList.contains("url")) { break; }
    }
    if (!el) { return; }
    _i = [].indexOf.call(Vomnibar.list.children, el.parentNode.parentNode);
    el.href = Vomnibar.completions[_i].url;
  },
  OnSelect: function() {
    var el = this, left, end;
    if (el.selectionStart !== 0 || el.selectionDirection !== "backward") { return; }
    left = el.value;
    end = el.selectionEnd - 1;
    if (left.charCodeAt(end) !== 32 || end === left.length - 1) { return; }
    left = left.substring(0, end).trimRight();
    if (left.indexOf(" ") === -1) {
      el.setSelectionRange(0, left.length, 'backward');
    }
  },
  OnUI: function(event) { Vomnibar.focused = event.type !== "blur"; },
  OnTimer: function() { Vomnibar && Vomnibar.filter(); },
  onWheel: function(event) {
    if (event.ctrlKey || event.metaKey) { return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.deltaX || Date.now() - this.wheelTimer < this.wheelInterval) { return; }
    this.wheelTimer = Date.now();
    this.goPage(event.deltaY > 0 ? 1 : -1);
  },
  onInput: function() {
    var s0 = this.lastQuery, s1 = this.input.value, str, i, j, arr;
    if ((str = s1.trim()) === (this.selection === -1 || this.isSelectionOrigin
        ? s0 : this.completions[this.selection].text)) {
      return;
    }
    if (this.matchType === 1 && s1.startsWith(s0)) { return; }
    i = this.input.selectionStart;
    if (this.isSearchOnTop) {}
    else if (i > s1.length - 2) {
      if (s1.endsWith(" +") && !this.timer && str.substring(0, str.length - 2).trimRight() === s0) {
        return;
      }
    } else if ((arr = this._pageNumRe.exec(s0)) && str.endsWith(arr[0])) {
      s1 = s1.trimRight(); j = arr[0].length;
      s1 = s1.substring(0, s1.length - j).trimRight();
      if (s1.trimLeft() !== s0.substring(0, s0.length - j).trimRight()) {
        this.input.value = s1;
        this.input.setSelectionRange(i, i);
      }
    }
    this.update();
  },
  omni: function(response) {
    if (!this.isActive) { return; }
    var list = response.list, height = list.length, oldHeight = this.height;
    this.matchType = response.matchType;
    this.completions = list;
    this.selection = response.autoSelect || this.modeType !== "omni" ? 0 : -1;
    this.isSelectionOrigin = true;
    this.isSearchOnTop = height > 0 && list[0].type === "search";
    if (height > 0) {
      height = (44 + (1 / (Math.max(1, window.devicePixelRatio)))) * height + 3;
    }
    this.height = height = (height | 0) + 54;
    if (oldHeight !== height) {
      VPort.postToOwner({ name: "style", height: height });
    }
    list.forEach(this.parse, this);
    return this.populateUI();
  },
  populateUI: function() {
    var list = this.list, noEmpty = this.completions.length > 0;
    this.input.parentElement.classList[noEmpty ? "add" : "remove"]("withList");
    list.style.display = noEmpty ? "" : "none";
    list.innerHTML = this.renderItems(this.completions);
    if (noEmpty) {
      this.selection === 0 && list.firstElementChild.classList.add("s");
      list.lastElementChild.classList.add("b");
    }
    return this.timer > 0 || this.postUpdate();
  },
  postUpdate: function() {
    var func;
    this.timer = 0;
    this.isEditing = false;
    if (func = this.onUpdate) {
      this.onUpdate = null;
      return func.call(this);
    }
  },
  init: function() {
    addEventListener("focus", VPort.EnsurePort, true);
    window.onclick = function(e) { Vomnibar.onClick(e); };
    this.onWheel = this.onWheel.bind(this);
    Object.setPrototypeOf(this.ctrlMap, null);
    Object.setPrototypeOf(this.normalMap, null);
    this.input = document.getElementById("input");
    this.list = document.getElementById("list");
    this.input.onfocus = this.input.onblur = this.OnUI;
    this.input.oninput = this.onInput.bind(this);
    this.list.oncontextmenu = this.OnMenu;
    document.getElementById("close").onclick = function() { Vomnibar.hide(); };
    addEventListener("keydown", this.handleKeydown, true);
    this.renderItems = VUtils.makeListRenderer(document.getElementById("template").innerHTML);
    this.init = VUtils.makeListRenderer = null;
  },
  handleKeydown: function(event) {
    var action = 2, stop;
    if (window.onkeyup) {
      if (!Vomnibar.isScrolling) {
        stop = event.keyCode > 17 || event.keyCode < 16;
      } else if ((stop = !event.repeat) ||
          (action = Date.now()) - Vomnibar.isScrolling > 40) {
        VPort.postToOwner(stop ? "scrollEnd" : "scrollGoing");
        Vomnibar.isScrolling = stop ? 0 : action;
      }
      if (stop) { window.onkeyup = null; }
    } else {
      action = Vomnibar.onKeydown(event);
    }
    if (action <= 0) { return; }
    if (action === 2) { event.preventDefault(); }
    event.stopImmediatePropagation();
  },
  returnFocus: function(request) {
    setTimeout(VPort.postToOwner, 0, { name: "focus", lastKey: request.lastKey });
  },

  mode: {
    handler: "omni",
    type: "",
    clientWidth: 0,
    maxResults: 10,
    query: ""
  },
  _spacesRe: /\s{2,}/g,
  filter: function() {
    var mode = this.mode, str, newMatchType = 0;
    if (this.useInput) {
      this.lastQuery = str = this.input.value.trim();
      str = str.replace(this._spacesRe, " ");
      if (str === mode.query) { return this.postUpdate(); }
      mode.type = this.matchType < 2 || !str.startsWith(mode.query) ? this.modeType
        : this.matchType === 3 ? "search"
        : (newMatchType = this.matchType, this.completions[0].type);
      mode.query = str;
      mode.clientWidth = window.innerWidth;
      this.matchType = newMatchType;
    } else {
      this.useInput = true;
    }
    this.timer = -1;
    VPort.postMessage(mode);
  },

  parse: function(item) {
    var str;
    if (this.showFavIcon && (str = item.url) && str.length <= 512 && str.indexOf("://") > 0) {
      item.favIconUrl = ' icon" style="background-image: url(&quot;chrome://favicon/size/16/' +
        VUtils.escapeCSSStringInAttr(str) + "&quot;)";
    } else {
      item.favIconUrl = "";
    }
    item.relevancy = this.showRelevancy ? '\n\t\t\t<span class="relevancy">'
      + item.relevancy + "</span>" : "";
  },
  navigateToUrl: function(item) {
    if (item.url.substring(0, 11).toLowerCase() === "javascript:") {
      return VPort.postToOwner({ name: "evalJS", url: item.url });
    }
    VPort.postMessage({
      handler: "openUrl",
      reuse: this.actionType,
      https: this.isHttps,
      url: item.url
    });
  },
  gotoSession: function(item) {
    VPort.postMessage({
      handler: "gotoSession",
      active: this.actionType > -2,
      sessionId: item.sessionId
    });
    if (this.actionType > -2) { return; }
    window.getSelection().removeAllRanges();
    if (item.type !== "tab") {
      this.refresh();
      return;
    }
    window.onfocus = function() {
      window.onfocus = null;
      VPort.port && Vomnibar.refresh();
    };
  }
},
VUtils = {
  makeListRenderer: function(template) {
    var o = null, a = template.split(/\{\{(\w+)}}/g)
      , f = function(w, i) { return (i & 1) && (w = o[w]) == null ? "" : w; }
      , m = function(i) { o = i; return a.map(f).join(""); };
    /a?/.test("");
    return function(objectArray) {
      var html = objectArray.map(m).join("");
      o = null;
      return html;
    };
  },
  decodeURL: function(url, decode) {
    try {
      url = (decode || decodeURI)(url);
    } catch (e) {}
    return url;
  },
  escapeCSSStringInAttr: function(s) {
    var escapeRe = /["&<>]/g, escapeCallback = function(c) {
      var i = c.charCodeAt(0);
      return i === 38 ? "&amp;" : i < 38 ? "\\&quot;" : i === 60 ? "&lt;" : "&gt;";
    };
    this.escapeCSSStringInAttr = function(s) {
      return s.replace(escapeRe, escapeCallback);
    };
    return this.escapeCSSStringInAttr(s);
  }
},
VPort = {
  port: null,
  postToOwner: null,
  postMessage: function(request) { (this.port || this.connect()).postMessage(request); },
  _callbacks: Object.create(null),
  _id: 1,
  sendMessage: function(request, callback) {
    var id = ++this._id;
    this.postMessage({_msgId: id, request: request});
    this._callbacks[id] = callback;
  },
  listener: function(response) {
    var id, handler;
    if (id = response._msgId) {
      handler = VPort._callbacks[id];
      delete VPort._callbacks[id];
      handler(response.response);
      return;
    }
    Vomnibar[response.name](response);
  },
  OnOwnerMessage: function(event) {
    var data = event.data, name = data.name || data;
    if (name === "focus" || name === "backspace") { name = "onAction"; }
    Vomnibar[name](data);
  },
  ClearPort: function() { VPort.port = null; },
  connect: function() {
    var port;
    /* eslint-env webextensions */
    this.port = port = chrome.runtime.connect({ name: "vimium++.8" });
    port.onDisconnect.addListener(this.ClearPort);
    port.onMessage.addListener(this.listener);
    return port;
  },
  EnsurePort: function() {
    if (!VPort || VPort.port) { return; }
    try { VPort.connect(); return; } catch (e) {}
    VPort.postToOwner({ name: "broken", active: Vomnibar.isActive });
    VPort = null;
    return true;
  },
  OnUnload: function() {
    var obj = Vomnibar;
    if (!(VPort && obj)) { return; }
    obj.isActive = false;
    obj.timer > 0 && clearTimeout(obj.timer);
    VPort.postToOwner("unload");
  }
};
(function() {
  var _secr = null, step = 0, _port, _options, timer,
  handler = function(secret, port, options) {
    if (0 === step++) {
      _secr = secret, _port = port, _options = options;
      return;
    }
    if (_secr !== secret) { return; }
    clearTimeout(timer);
    window.onmessage = null;
    port || (port = _port);
    options || (options = _options);
    VPort.postToOwner = port.postMessage.bind(port);
    port.onmessage = VPort.OnOwnerMessage;
    window.onunload = VPort.OnUnload;
    return options ? Vomnibar.activate(options) : port.postMessage("uiComponentIsReady");
  };
  timer = setTimeout(function() { window.location = "about:blank"; }, 700);
  VPort.sendMessage({ handler: "secret" }, handler);
  window.onmessage = function(event) {
    event.source === window.parent && handler(event.data[0], event.ports[0], event.data[1]);
  };
})();

if (!String.prototype.startsWith) {
String.prototype.startsWith = function(s) {
  return this.length >= s.length && this.lastIndexOf(s, 0) === 0;
};
String.prototype.endsWith || (String.prototype.endsWith = function(s) {
  var i = this.length - s.length;
  return i >= 0 && this.indexOf(s, i) === i;
});
}
