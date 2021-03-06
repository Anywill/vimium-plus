"use strict";
var VHints = {
  CONST: {
    // focused: 1; new tab: 2; queue: 64; job: 128
    // >=128: "&4" means "must be links" and [data-vim-url] is used firstly
    //   &~64 >= 136 means only `<a>`
    // >= 256: queue not allowed
    OPEN_IN_CURRENT_TAB: 0, // also 1
    OPEN_IN_NEW_BG_TAB: 2,
    OPEN_IN_NEW_FG_TAB: 3,
    OPEN_WITH_QUEUE: 66,
    OPEN_FG_WITH_QUEUE: 67,
    HOVER: 128,
    LEAVE: 129,
    COPY_TEXT: 130,
    SEARCH_TEXT: 131,
    DOWNLOAD_IMAGE: 132,
    OPEN_IMAGE: 133,
    DOWNLOAD_LINK: 136,
    COPY_LINK_URL: 137,
    OPEN_INCOGNITO_LINK: 138,
    FOCUS_EDITABLE: 258,
    EDIT_LINK_URL: 257,
    EDIT_TEXT: 256
  },
  box: null,
  hintMarkers: null,
  mode: 0,
  mode1: 0,
  modeOpt: null,
  count: 0,
  lastMode: 0,
  isClickListened: true,
  ngEnabled: null,
  keyStatus: {
    known: false,
    newHintLength: 0,
    tab: 0
  },
  initTimer: 0,
  isActive: false,
  options: null,
  timer: 0,
  activate: function(count, options) {
    if (this.isActive) { return; }
    if (document.body == null) {
      if (!this.initTimer && document.readyState === "loading") {
        this.initTimer = setTimeout(this.activate.bind(this, count, options), 300);
        return;
      }
      if (!VDom.isHTML()) { return; }
    }
    VHandler.remove(this);
    this.setModeOpt(Object.setPrototypeOf(options || {}, null), count | 0);

    var elements, arr = VDom.getViewBox();
    this.maxLeft = arr[2], this.maxTop = arr[3], this.maxRight = arr[4];
    if (!this.frameNested) {
      elements = this.getVisibleElements();
    }
    if (this.frameNested) {
      if (this.tryNestedFrame("VHints.activate", count, this.options)) {
        this.clean();
        return;
      }
      elements || (elements = this.getVisibleElements());
    }
    if (elements.length <= 0) {
      this.clean(true);
      VHUD.showForDuration("No links to select.", 1000);
      return;
    }

    if (this.box) { this.box.remove(); this.box = null; }
    this.hintMarkers = elements.map(this.createMarkerFor, this);
    this.adjustMarkers(elements);
    elements = null;
    this.alphabetHints.initMarkers(this.hintMarkers);

    this.setMode(this.mode);
    this.box = VDom.UI.addElementList(this.hintMarkers, arr);

    this.isActive = true;
    VHandler.push(this.onKeydown, this);
    VEventMode.onWndBlur(this.ResetMode);
  },
  setModeOpt: function(options, count) {
    if (this.options === options) { return; }
    var ref = this.Modes, i, ref2 = this.CONST, mode = ref2[options.mode] | 0, modeOpt;
    if (mode == ref2.EDIT_TEXT && options.url) {
      mode = ref2.EDIT_LINK_URL;
    } else if (mode == ref2.EDIT_LINK_URL || (mode & ~64) == ref2.COPY_LINK_URL) {
      options.url = true;
    }
    if (count > 1) { mode <= 256 ? (mode |= 64) : (count = 1); }
    for (i in ref) {
      if (ref.hasOwnProperty(i) && ref[i].hasOwnProperty(mode)) {
        modeOpt = ref[i];
        break;
      }
    }
    if (!modeOpt) {
      modeOpt = ref.DEFAULT;
      mode = count > 1 ? this.CONST.OPEN_WITH_QUEUE : this.CONST.OPEN_IN_CURRENT_TAB;
    }
    this.modeOpt = modeOpt;
    this.mode = mode;
    this.mode1 = mode & ~64;
    this.options = options;
    this.count = count;
  },
  setMode: function(mode) {
    this.mode = mode;
    this.mode1 = mode & ~64;
    VHUD.show(this.modeOpt[mode]);
  },
  tryNestedFrame: function(command, a, b) {
    this.frameNested === false && this.checkNestedFrame();
    if (!this.frameNested) { return false; }
    var child, done = false;
    try {
      child = this.frameNested.contentWindow;
      if (command.startsWith("VHints.activate")) {
        if (!child.document.head) { throw Error("vimium-disabled"); }
        (done = child.VHints.isActive) && child.VHints.deactivate(true);
      }
      child.VEventMode.keydownEvents(VEventMode.keydownEvents());
    } catch (e) {
      // It's cross-site, or Vimium++ on the child is wholly disabled
      // * Cross-site: it's in an abnormal situation, so we needn't focus the child;
      this.frameNested = null;
      return false;
    }
    child.focus();
    if (done) { return true; }
    if (document.readyState !== "complete") { this.frameNested = false; }
    return VUtils.execCommand(child, command, a, b) !== false;
  },
  maxLeft: 0,
  maxTop: 0,
  maxRight: 0,
  zIndexes: null,
  createMarkerFor: function(link) {
    var marker = VDom.createElement("span"), i, st;
    marker.clickableItem = link[0];
    i = link.length < 5 ? link[1][0] : link[4][0][0] + link[4][1];
    marker.className = link[2] < 7 ? "LH" : "LH BH";
    st = marker.style;
    st.left = i + "px";
    if (i > this.maxLeft) {
      st.maxWidth = this.maxRight - i + "px";
    }
    i = link[1][1];
    st.top = i + "px";
    if (i > this.maxTop) {
      st.maxHeight = this.maxTop - i + 15 + "px";
    }
    link[3] && (marker.linkRect = link[3]);
    return marker;
  },
  adjustMarkers: function(elements) {
    var arr, i, root = VDom.UI.root, z = 1 / VDom.bodyZoom + "";
    if (!root || z === "1") { return; }
    arr = this.hintMarkers, i = elements.length - 1;
    if (elements[i][0] === Vomnibar.box) { arr[i--].style.zoom = z; }
    if (!root.querySelector('#HelpDialog') || i < 0) { return; }
    while (0 <= i && root.contains(elements[i][0])) { arr[i--].style.zoom = z; }
  },
  btnRe: /\b(?:[Bb](?:utto|t)n|[Cc]lose)(?:$| )/,
  GetClickable: function(element) {
    if (element instanceof HTMLFormElement) { return; }
    var arr, isClickable = null, s, type = 0;
    switch (element.tagName.toLowerCase()) {
    case "a": case "details": isClickable = true; break;
    case "frame": case "iframe":
      isClickable = element !== VFindMode.box;
      type = isClickable ? 7 : 0;
      break;
    case "input": if (element.type === "hidden") { return; } // no break;
    case "textarea":
      if (element.disabled && VHints.mode1 <= VHints.CONST.LEAVE) { return; }
      if (!element.readOnly || VHints.mode >= 128
        || element instanceof HTMLInputElement && (element.type in VDom.uneditableInputs)) {
        isClickable = true;
      }
      break;
    case "label":
      if (element.control) {
        if (element.control.disabled) { return; }
        VHints.GetClickable.call(arr = [], element.control);
        isClickable = arr.length === 0;
      }
      break;
    case "button": case "select":
      isClickable = !element.disabled || VHints.mode1 > VHints.CONST.LEAVE; break;
    case "object": case "embed":
      s = element.type;
      if (s && s.endsWith("x-shockwave-flash")) { isClickable = true; break; }
      return;
    case "img":
      if (element.useMap && VDom.getClientRectsForAreas(element, this)) { return; }
      if ((VHints.mode >= 128 && VHints.mode1 <= VHints.CONST.LEAVE
          && !(element.parentNode instanceof HTMLAnchorElement))
        || ((s = element.style.cursor) ? s !== "default"
          : (s = getComputedStyle(element).cursor) && (s.startsWith("url") || s.indexOf("zoom") >= 0)
        )) {
        isClickable = true;
      }
      break;
    case "div": case "ul": case "pre": case "ol":
      type = (type = element.clientHeight) && type + 5 < element.scrollHeight ? 9
        : (type = element.clientWidth) && type + 5 < element.scrollWidth ? 8 : 0;
      break;
    }
    if (isClickable === null) {
      type = (s = element.contentEditable) !== "inherit" && s && s !== "false" ? 1
        : (element.vimiumHasOnclick && VHints.isClickListened) || element.getAttribute("onclick")
          || VHints.ngEnabled && element.getAttribute("ng-click")
          || (s = element.getAttribute("role")) && (s = s.toLowerCase()
            , s === "button" || s === "link" || s === "checkbox" || s === "radio" || s.startsWith("menuitem"))
          || (s = element.getAttribute("jsaction")) && VHints.checkJSAction(s) ? 2
        : (s = element.getAttribute("tabindex")) && parseInt(s, 10) >= 0 ? 5
        : type > 5 ? type : (s = element.className) && VHints.btnRe.test(s) ? 4 : 0;
    }
    if ((isClickable || type) && (arr = VDom.getVisibleClientRect(element))
        && (type < 8 || VScroller.isScrollable(element, type - 8))
        && ((s = element.getAttribute("aria-hidden")) == null || s && s.toLowerCase() !== "true")
        && ((s = element.getAttribute("aria-disabled")) == null || (s && s.toLowerCase() !== "true")
          || VHints.mode >= 128)
    ) { this.push([element, arr, type]); }
  },
  noneActionRe: /\._\b(?![\$\.])/,
  checkJSAction: function(s) {
    for (var arr = s.split(";"), i = arr.length, t; 0 <= --i; ) {
      s = arr[i].trim();
      t = s.startsWith("click:") ? (s = s.substring(6)) : s && s.indexOf(":") === -1 ? s : null;
      if (t && t !== "none" && !this.noneActionRe.test(t)) {
        return true;
      }
    }
  },
  GetEditable: function(element) {
    if (element instanceof HTMLFormElement) { return; }
    var arr, type = 0, s;
    switch (element.tagName.toLowerCase()) {
    case "input":
      if (element.type in VDom.uneditableInputs) {
        return;
      } // no break;
    case "textarea":
      if (element.disabled || element.readOnly) { return; }
      break;
    default:
      if ((s = element.contentEditable) === "inherit" || !s || s === "false") { return; }
      type = 1;
      break;
    }
    if (arr = VDom.getVisibleClientRect(element)) {
      this.push([element, arr, type]);
    }
  },
  GetLinks: function(element) {
    var a, arr;
    if ((a = element.getAttribute("href")) && a !== "#"
        && (a.charCodeAt(10) !== 58 || a.substring(0, 11).toLowerCase() !== "javascript:")
        || element.hasAttribute("data-vim-url")) {
      if (arr = VDom.getVisibleClientRect(element)) {
        this.push([element, arr, 0]);
      }
    }
  },
  imageUrlRe: /\.(?:bmp|gif|ico|jpe?g|png|svg|webp)\b/i,
  GetImagesInImg: function(element) {
    var rect, cr, w, h;
    if (!element.src) { return; }
    else if ((w = element.width) < 8 && (h = element.height) < 8) {
      if (w !== h || (w !== 0 && w !== 3)) { return; }
      rect = element.getClientRects()[0];
      if (rect) {
        w = rect.left; h = rect.top;
        cr = VRect.cropRectToVisible(w, h, w + 8, h + 8);
      }
    } else if (rect = element.getClientRects()[0]) {
      w = rect.right + (rect.width < 3 ? 3 : 0);
      h = rect.bottom + (rect.height < 3 ? 3 : 0);
      if (cr = VRect.cropRectToVisible(rect.left, rect.top, w, h)) {
        if (!VDom.isStyleVisible(window.getComputedStyle(element))) {
          cr = null;
        }
      }
    }
    if (cr) {
      this.push([element, cr, 0]);
    }
  },
  GetImagesInA: function(element) {
    var str = element.getAttribute("href"), cr;
    if (str && str.length > 4 && VHints.imageUrlRe.test(str)) {
      if (cr = VDom.getVisibleClientRect(element)) {
        this.push([element, cr, 0]);
      }
    }
  },
  traverse: function(filters, box) {
    var output = [], key, func, wantClickable = filters["*"] === this.GetClickable;
    Object.setPrototypeOf(filters, null);
    VDom.prepareCrop();
    box = box || document.webkitFullscreenElement || document;
    if (this.ngEnabled === null && ("*" in filters)) {
      this.ngEnabled = document.querySelector('.ng-scope') != null;
    }
    for (key in filters) {
      func = filters[key].bind(output);
      if (VSettings.cache.deepHints) {
        output.forEach.call(box.querySelectorAll("* /deep/ " + key), func);
        continue;
      }
      output.forEach.call(box.getElementsByTagName(key), func);
      if (VDom.UI.root) {
        output.forEach.call(VDom.UI.root.querySelectorAll(key), func);
      }
    }
    if (wantClickable) { this.deduplicate(output); }
    if (this.frameNested !== false) {}
    else if (wantClickable) {
      this.checkNestedFrame(output);
    } else if (output.length > 0) {
      this.frameNested = null;
    } else {
      this.checkNestedFrame();
    }
    return output;
  },
  deduplicate: function(list) {
    var j = list.length, i, k;
    while (0 < --j) {
      if (list[i = j][2] !== 4) {
      } else if ((k = list[--j][2]) > 7 || !this.isDescendant(list[i][0], list[j][0])) {
        continue;
      } else if (VRect.isContaining(list[j][1], list[i][1])) {
        list.splice(i, 1);
        continue;
      } else if (k < 2 || j === 0) {
        continue;
      }
      while (0 < j && (k = list[j - 1][2]) >= 2 && k <= 5 && this.isDescendant(list[j][0], list[j - 1][0])) {
        j--;
        if (j === i - 3) { break; }
      }
      if (j < i) {
        list.splice(j, i - j);
      }
    }
    i = list[0] ? +(list[0][0] === document.documentElement) : 0;
    if (list[i] && list[i][0] === document.body) { ++i; }
    if (i > 0) { i === 1 ? list.shift() : list.splice(0, i); }
  },
  isDescendant: function(d, p) {
    for (var i = 3, c, f; 0 < i-- && (c = d.parentNode) !== p && c; d = c) {}
    if (c !== p) { return false; }
    for (; ; ) {
      if (c.childElementCount !== 1 || ((f = c.firstChild) instanceof Text && f.data.trim())) { return false; }
      if (i === 2) { break; }
      c = c.firstElementChild; i++;
    }
    return true;
  },
  frameNested: false,
  checkNestedFrame: function(output) {
    var res = this._getNestedFrame(output);
    this.frameNested = res === false && document.readyState === "complete" ? null : res;
  },
  _getNestedFrame: function(output) {
    var rect, rect2, element, func;
    if (window.frames[0] == null) { return false; }
    if (document.webkitIsFullScreen) { return null; }
    if (output == null) {
      if (!VDom.isHTML()) { return false; }
      output = [];
      func = this.GetClickable.bind(output);
      VDom.prepareCrop();
      output.forEach.call(document.getElementsByTagName("iframe"), func);
      if (output.length === 0 && document.body instanceof HTMLFrameSetElement) {
        output.forEach.call(document.body.getElementsByTagName("frame"), func);
      }
    }
    if (output.length !== 1) {
      return output.length !== 0 && null;
    }
    element = output[0][0];
    if (
      ((element instanceof HTMLIFrameElement) || (element instanceof HTMLFrameElement))
        && (rect = element.getClientRects()[0])
        && (rect2 = document.documentElement.getBoundingClientRect())
        && rect.top - rect2.top < 20 && rect.left - rect2.left < 20
        && rect2.right - rect.right < 20 && rect2.bottom - rect.bottom < 20
        && getComputedStyle(element).visibility === 'visible'
    ) {
      return element;
    }
    return null;
  },
  getVisibleElements: function() {
    var visibleElements, visibleElement, _len, _i, _j, obj, func
      , r, r2 = null, t, isNormal, reason, _k, _ref;
    _i = this.mode1;
    visibleElements = this.traverse(
      (_i === this.CONST.DOWNLOAD_IMAGE || _i === this.CONST.OPEN_IMAGE)
      ? { img: this.GetImagesInImg, a: this.GetImagesInA }
      : _i === this.CONST.EDIT_LINK_URL || (_i < 256 && _i >= 136) ? { a: this.GetLinks }
      : {"*": _i === this.CONST.FOCUS_EDITABLE ? this.GetEditable
              : this.GetClickable});
    isNormal = _i < 128;
    if (this.maxRight > 0) {
      _i = Math.ceil(Math.log(visibleElements.length) / Math.log(VSettings.cache.linkHintCharacters.length));
      this.maxLeft -= 11 * _i + 8;
    }
    visibleElements.reverse();

    obj = [null, null];
    func = VRect.SubtractSequence.bind(obj);
    for (_len = visibleElements.length, _j = Math.max(0, _len - 16); 0 < --_len; ) {
      _j > 0 && --_j;
      visibleElement = visibleElements[_len];
      if (visibleElement[2] >= 7) { continue; }
      r = visibleElement[1];
      for (_i = _len; _j <= --_i; ) {
        t = visibleElements[_i][1];
        if (r[3] <= t[1] || r[2] <= t[0] || r[0] >= t[2] || r[1] >= t[3]) { continue; }
        if (visibleElements[_i][2] >= 7) { continue; }
        obj[0] = []; obj[1] = t;
        r2 !== null ? r2.forEach(func) : func(r);
        if ((r2 = obj[0]).length === 0) { break; }
      }
      if (r2 === null) { continue; }
      if (r2.length > 0) {
        t = r2[0];
        t[1] > this.maxTop && t[1] > r[1] || t[0] > this.maxLeft && t[0] > r[0] ||
          r2.length === 1 && !VRect.testCrop(t) || (visibleElement[1] = t);
      } else if ((reason = visibleElement[2]) === 4 || (reason === 2 ? isNormal : reason === 5)
          && visibleElement[0].contains(visibleElements[_i][0])) {
        visibleElements.splice(_len, 1);
      } else {
        _ref = visibleElement[4] || [r, 0];
        r = _ref[0];
        for (_k = _len; _i <= --_k; ) {
          t = visibleElements[_k][1];
          if (r[0] >= t[0] && r[1] >= t[1] && r[0] < t[0] + 20 && r[1] < t[1] + 15) {
            visibleElements[_k][4] = [r, _ref[1] + 13];
            break;
          }
        }
      }
      r2 = null;
    }
    return visibleElements.reverse();
  },
  onKeydown: function(event) {
    var linksMatched, i, j, ref, limit;
    if (event.repeat) {
      // NOTE: should always prevent repeated keys.
    } else if (VKeyboard.isEscape(event)) {
      this.deactivate();
    } else if ((i = event.keyCode) === VKeyCodes.esc) {
      return 1;
    } else if (i > VKeyCodes.f1 && i <= VKeyCodes.f12) {
      this.ResetMode();
      if (i !== VKeyCodes.f1 + 1) { return 0; }
      i = VKeyboard.getKeyStat(event);
      if (i === 8) {
        this.isClickListened = !this.isClickListened;
      } else if (i === 0) {
        VSettings.cache.deepHints = !VSettings.cache.deepHints;
      }
      setTimeout(this.reinit.bind(this, null), 0);
    } else if (i === VKeyCodes.shiftKey) {
      if (this.mode < 128) {
        if (VKeyboard.getKeyStat(event) === 8) {
          this.lastMode = this.mode;
        }
        this.setMode((this.mode | 1) ^ (this.mode < 64 ? 3 : 67));
      }
    } else if (i === VKeyCodes.ctrlKey || i === VKeyCodes.metaKey) {
      if (this.mode < 128) {
        if (!(event.shiftKey || event.altKey)) {
          this.lastMode = this.mode;
        }
        this.setMode((this.mode | 2) ^ 1);
      }
    } else if (i === VKeyCodes.altKey) {
      if (this.mode < 256) {
        if (VKeyboard.getKeyStat(event) === 1) {
          this.lastMode = this.mode;
        }
        this.setMode(((this.mode >= 128 ? 0 : 2) | this.mode) ^ 64);
      }
    } else if (i >= VKeyCodes.pageup && i <= VKeyCodes.down) {
      VEventMode.scroll(event);
      this.ResetMode();
    } else if (i === VKeyCodes.space) {
      this.zIndexes === false || this.rotateHints(event.shiftKey);
      event.shiftKey && this.ResetMode();
    } else if (!(linksMatched = this.alphabetHints.matchHintsByKey(this.hintMarkers, event, this.keyStatus))){
      if (linksMatched === false) {
        setTimeout(this.reinit.bind(this, null), 0);
      }
    } else if (linksMatched.length === 0) {
      this.deactivate(this.keyStatus.known);
    } else if (linksMatched.length === 1) {
      VUtils.Prevent(event);
      this.activateLink(linksMatched[0]);
    } else {
      limit = this.keyStatus.tab ? 0 : this.keyStatus.newHintLength;
      for (i = linksMatched.length; 0 <= --i; ) {
        ref = linksMatched[i].childNodes;
        for (j = ref.length; limit <= --j; ) {
          ref[j].classList.remove("MC");
        }
        for (; 0 <= j; --j) {
          ref[j].classList.add("MC");
        }
      }
    }
    return 2;
  },
  ResetMode: function() {
    if (VHints.mode > 255 || VHints.lastMode === VHints.mode) { return; }
    var d = VEventMode.keydownEvents();
    if (d[VKeyCodes.ctrlKey] || d[VKeyCodes.metaKey] || d[VKeyCodes.shiftKey] || d[VKeyCodes.altKey]) {
      VHints.setMode(VHints.lastMode);
    }
  },
  _resetMarkers: function() {
    var ref = this.hintMarkers, i = 0, len = ref ? ref.length : 0;
    this.hintMarkers = null;
    while (i < len) { ref[i++].clickableItem = null; }
  },
  activateLink: function(hintEl) {
    var rect, clickEl = hintEl.clickableItem;
    this._resetMarkers();
    if (VDom.isInDOM(clickEl)) {
      // must get outline first, because clickEl may hide itself when activated
      rect = hintEl.linkRect || VDom.UI.getVRect(clickEl);
      if (this.modeOpt.activator.call(this, clickEl, hintEl) !== false) {
        setTimeout(function(force) {
          (force || document.hasFocus()) && VDom.UI.flash(null, rect);
        }, 17, clickEl instanceof HTMLIFrameElement || clickEl instanceof HTMLFrameElement);
      }
    } else {
      clickEl = null;
      VHUD.showForDuration("The link has been removed from the page", 2000);
    }
    if (!(this.mode & 64)) {
      this.deactivate(true);
      return;
    }
    setTimeout(function() {
      var _this = VHints;
      _this.reinit(clickEl, rect);
      if (1 === --_this.count && _this.isActive) {
        _this.setMode(_this.mode1);
      }
    }, 0);
  },
  reinit: function(lastEl, rect) {
    this.isActive = false;
    this.keyStatus.tab = 0;
    this.zIndexes = null;
    this._resetMarkers();
    this.activate(0, this.options);
    this.timer && clearTimeout(this.timer);
    if (this.isActive && lastEl && this.mode < 128) {
      this.timer = setTimeout(this.TestLastEl, 255, lastEl, rect);
    } else {
      this.timer = 0;
    }
  },
  TestLastEl: function(el, r) {
    var r2, _this = VHints;
    if (!_this) { return; }
    _this.timer = 0;
    if (!_this.isActive || _this.hintMarkers.length > 128 || _this.alphabetHints.hintKeystroke) {
      return;
    }
    VDom.prepareCrop();
    r2 = VDom.getVisibleClientRect(el);
    if (r2 && r && Math.abs(r2[0] - r[0]) < 100 && Math.abs(r2[1] - r[1]) < 60) {
      return;
    }
    _this.reinit();
  },
  clean: function(keepHUD) {
    this.options = this.modeOpt = this.zIndexes = this.hintMarkers = null;
    this.lastMode = this.mode = this.mode1 = this.count =
    this.maxLeft = this.maxTop = this.maxRight = 0;
    if (this.box) {
      this.box.remove();
      this.box = null;
    }
    keepHUD || VHUD.hide();
    var alpha = this.alphabetHints;
    alpha.hintKeystroke = alpha.chars = "";
    alpha.countMax = 0;
    VEventMode.onWndBlur(null);
  },
  deactivate: function(suppressType) {
    this.clean(VHUD.text !== this.modeOpt[this.mode]);
    this.keyStatus.tab = this.keyStatus.newHintLength = 0;
    VHandler.remove(this);
    this.isActive = false;
    suppressType != null && VDom.UI.suppressTail(suppressType);
  },
  rotateHints: function(reverse) {
    var ref = this.hintMarkers, stacks = this.zIndexes, i, stack, len, j, style, oldI, newI;
    if (!stacks) {
      ref.forEach(this.MakeStacks, [[], stacks = []]);
      stacks = stacks.filter(function(stack) { return stack.length > 1; });
      if (stacks.length <= 0 && this.keyStatus.newHintLength <= 0) {
        this.zIndexes = false; return;
      }
      this.zIndexes = stacks.length > 0 ? stacks : null;
    }
    for (i = stacks.length; 0 <= --i; ) {
      stack = stacks[i];
      reverse && stack.reverse();
      j = (len = stack.length) - 1;
      oldI = ref[stack[j]].style.zIndex || stack[j];
      for (j = 0; j < len; j++, oldI = newI) {
        style = ref[stack[j]].style;
        newI = style.zIndex || stack[j];
        style.zIndex = oldI;
      }
      reverse && stack.reverse();
    }
  },
  MakeStacks: function(marker, i) {
    var rects = this[0], stacks, m, j, len2, stack, stackForThisMarker, k, len3, t;
    if (marker.style.visibility === "hidden") { rects.push(null); return; }
    rects.push(m = marker.getClientRects()[0]);
    stackForThisMarker = null;
    for (stacks = this[1], j = 0, len2 = stacks.length; j < len2; ) {
      stack = stacks[j];
      for (k = 0, len3 = stack.length; k < len3; k++) {
        t = rects[stack[k]];
        if (m.bottom > t.top && m.top < t.bottom && m.right > t.left && m.left < t.right) {
          break;
        }
      }
      if (k >= len3) {}
      else if (stackForThisMarker) {
        stackForThisMarker.push.apply(stackForThisMarker, stack);
        stacks.splice(j, 1); len2--;
        continue;
      } else {
        stack.push(i);
        stackForThisMarker = stack;
      }
      j++;
    }
    stackForThisMarker || stacks.push([i]);
  },
  unhoverLast: function() {
    VDom.unhoverLast(null);
  },

alphabetHints: {
  chars: "",
  hintKeystroke: "",
  countMax: 0,
  countLimit: 0,
  numberToHintString: function(number) {
    var base, hintString, remainder, characterSet = this.chars;
    base = characterSet.length;
    hintString = "";
    do {
      remainder = number % base;
      number = (number / base) | 0;
      hintString = characterSet[remainder] + hintString;
    } while (number > 0);
    number = this.countMax - hintString.length - (number < this.countLimit);
    if (number > 0) {
      hintString = this.repeat(characterSet[0], number) + hintString;
    }
    return hintString;
  },
  initMarkers: function(hintMarkers) {
    var hints, hintString, marker, end, i, len, node;
    this.chars = VSettings.cache.linkHintCharacters.toUpperCase();
    this.hintKeystroke = "";
    end = hintMarkers.length;
    hints = this.buildHintIndexes(end);
    while (0 <= --end) {
      marker = hintMarkers[end];
      hintString = this.numberToHintString(hints[end]);
      marker.hintString = hintString;
      for (i = 0, len = hintString.length; i < len; i++) {
        node = document.createElement('span');
        node.textContent = hintString[i];
        marker.appendChild(node);
      }
    }
    this.countMax -= this.countLimit > 0;
    this.countLimit = 0;
  },
  buildHintIndexes: function(linkCount) {
    var dn, hints, i, end;
    end = this.chars.length;
    dn = Math.ceil(Math.log(linkCount) / Math.log(end));
    end = ((Math.pow(end, dn) - linkCount) / (end - 1)) | 0;
    this.countMax = dn; this.countLimit = end;
    for (hints = [], i = 0; i < end; i++) {
      hints.push(i);
    }
    for (end *= this.chars.length - 1; i < linkCount; i++) {
      hints.push(i + end);
    }
    return this.shuffleHints(hints);
  },
  shuffleHints: function(hints) {
    var result, count, len, start, i, j, max, j0;
    count = hints.length; len = this.chars.length;
    start = (count % len);
    max = count - start + len;
    result = [];
    for (j0 = i = 0; i < len; i++, j0++) {
      if (i === start) { max -= len; }
      for (j = j0; j < max; j += len) {
        result.push(hints[j]);
      }
    }
    return result;
  },
  matchHintsByKey: function(hintMarkers, event, keyStatus) {
    var keyChar, key = event.keyCode, wanted, arr = null;
    if (key === VKeyCodes.tab) {
      if (!this.hintKeystroke) {
        return false;
      }
      keyStatus.tab = keyStatus.tab ? 0 : 1;
    } else if (keyStatus.tab) {
      this.hintKeystroke = "";
      keyStatus.tab = 0;
    }
    keyStatus.known = true;
    if (key === VKeyCodes.tab) {}
    else if (key === VKeyCodes.backspace || key === VKeyCodes.deleteKey || key === VKeyCodes.f1) {
      if (!this.hintKeystroke) {
        return [];
      }
      this.hintKeystroke = this.hintKeystroke.slice(0, -1);
    } else if (keyChar = VKeyboard.getKeyChar(event).toUpperCase()) {
      if (this.chars.indexOf(keyChar) === -1) {
        return [];
      }
      this.hintKeystroke += keyChar;
      arr = [];
    } else {
      return null;
    }
    keyChar = this.hintKeystroke;
    keyStatus.newHintLength = keyChar.length;
    keyStatus.known = false;
    VHints.zIndexes && (VHints.zIndexes = null);
    wanted = !keyStatus.tab;
    if (arr !== null && keyChar.length >= this.countMax) {
      hintMarkers.some(function(linkMarker) {
        return linkMarker.hintString === keyChar && arr.push(linkMarker);
      });
      if (arr.length === 1) { return arr; }
    }
    return hintMarkers.filter(function(linkMarker) {
      var pass = linkMarker.hintString.startsWith(keyChar) === wanted;
      linkMarker.style.visibility = pass ? "" : "hidden";
      return pass;
    });
  },
  repeat: function(s, n) {
    if (s.repeat) { return s.repeat(n); }
    for (var s2 = s; --n; ) { s2 += s; }
    return s2;
  }
},

getUrlData: function(link) {
  var str = link.getAttribute("data-vim-url");
  if (str) {
    link = VDom.createElement("a");
    link.href = str.trim();
  }
  return link.href;
},

highlightChild: function(child) {
  setTimeout(function() { child.focus(); }, 0);
  try {
    child.VEventMode.keydownEvents(VEventMode.keydownEvents());
  } catch (e) {
    return;
  }
  child.VEventMode.exitGrab();
  var lh = child.VHints;
  lh.isActive = false;
  lh.activate(this.count, this.options);
  lh.isActive && lh.setMode(this.mode);
  return false;
},

Modes: {
HOVER: {
  128: "Hover over node",
  192: "Hover over nodes continuously",
  activator: function(element) {
    var type = VDom.getEditableType(element);
    VDom.unhoverLast(element);
    VScroller.current = element;
    if (type === 0 && element.tabIndex >= 0) { element.focus(); }
    this.mode < 128 && VHUD.showForDuration("Hover for scrolling", 1000);
  }
},
LEAVE: {
  129: "Simulate mouse leaving link",
  193: "Simulate mouse leaving continuously",
  activator: function(element) {
    VDom.mouse(element, "mouseout");
    if (document.activeElement === element) { element.blur(); }
  }
},
COPY_TEXT: {
  130: "Copy link text to Clipboard",
  131: "Search selected text",
  137: "Copy link URL to Clipboard",
  194: "Copy link text one by one",
  195: "Search link text one by one",
  201: "Copy link URL one by one",
  256: "Edit link text on Vomnibar",
  257: "Edit link url on Vomnibar",
  activator: function(link) {
    var isUrl = !!this.options.url, str;
    if (isUrl) { str = this.getUrlData(link); }
    else if ((str = link.getAttribute("data-vim-text")) && (str = str.trim())) {}
    else if ((str = link.nodeName.toLowerCase()) === "input") {
      str = link.type;
      if (str === "password") {
        str = "";
      } else if (!(str in VDom.uneditableInputs)) {
        str = (link.value || link.placeholder).trim();
      } else if (str === "file") {
        str = link.files.length > 0 ? link.files[0].name : "";
      } else if (["button", "submit", "reset"].indexOf(str) >= 0) {
        str = link.value.trim() || link.title.trim();
      } else {
        str = link.title.trim(); // including `[type="image"]`
      }
    } else {
      str = str === "textarea" ? link.value
        : str === "select" ? (link.selectedIndex < 0 ? "" : link.options[link.selectedIndex].text)
        : link.innerText.trim() || (str = link.textContent.trim()) && str.replace(/\s+/g, " ")
        ;
      str = str.trim() || link.title.trim();
    }
    if (!str) {
      VHUD.showCopied("", isUrl && "url");
      return;
    }
    if (this.mode >= this.CONST.EDIT_TEXT && this.mode <= this.CONST.EDIT_LINK_URL) {
      VPort.post({
        handler: "activateVomnibar",
        count: 1,
        force: !isUrl,
        url: str,
        keyword: this.options.keyword
      });
      return;
    } else if (this.mode1 === this.CONST.SEARCH_TEXT) {
      VPort.post({
        handler: "openUrl",
        reuse: -2 + !(this.mode & 64),
        keyword: this.options.keyword,
        url: str
      });
      return;
    }
    // NOTE: url should not be modified
    // although BackendUtils.convertToUrl does replace '\u3000' with ' '
    str = isUrl ? VUtils.decodeURL(str) : str;
    VPort.post({
      handler: "copyToClipboard",
      data: str
    });
    VHUD.showCopied(str);
  }
},
OPEN_INCOGNITO_LINK: {
  138: "Open link in incognito",
  202: "Open multi incognito tabs",
  activator: function(link) {
    var url = this.getUrlData(link);
    if (VUtils.evalIfOK(url)) { return; }
    VPort.post({
      handler: "openUrl",
      incognito: true,
      reuse: !(this.mode & 64) - 2,
      keyword: this.options.keyword,
      url: url
    });
  }
},
DOWNLOAD_IMAGE: {
  132: "Download image",
  196: "Download multiple images",
  activator: function(img) {
    var text = img instanceof HTMLAnchorElement ? img.href : img.src, i, a;
    if (!text) {
      VHUD.showForDuration("Not an image", 1000);
      return;
    }
    i = text.indexOf("://");
    if (i > 0) {
      text = text.substring(text.indexOf('/', i + 4) + 1);
    }
    if (text.length > 39) {
      text = text.substring(0, 36) + "...";
    }
    a = VDom.createElement("a");
    a.href = img.src;
    a.download = img.getAttribute("download") || "";
    a.click();
    VHUD.showForDuration("Download: " + text, 2000);
  }
},
OPEN_IMAGE: {
  133: "Open image",
  197: "Open multiple image",
  activator: function(img) {
    var text = img instanceof HTMLAnchorElement ? img.href : img.src, url, str;
    if (!text) {
      VHUD.showForDuration("Not an image", 1000);
      return;
    }
    url = "vimium://show image ";
    if (str = img.getAttribute("download")) {
      url += "download=" + encodeURIComponent(str) + "&";
    }
    VPort.post({
      handler: "openUrl",
      reuse: (this.mode & 64) ? -2 : -1,
      url: url + text
    });
  }
},
DOWNLOAD_LINK: {
  136: "Download link",
  200: "Download multiple links",
  activator: function(link) {
    var oldDownload, oldUrl;
    oldUrl = link.getAttribute("href");
    if (!oldUrl || oldUrl === "#") {
      oldDownload = link.getAttribute("data-vim-url");
      if (oldDownload && (oldDownload = oldDownload.trim())) {
        link.href = oldDownload;
      }
    }
    oldDownload = link.getAttribute("download");
    if (oldDownload == null) {
      link.download = "";
    }
    VDom.UI.click(link, {
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false
    });
    if (typeof oldDownload === "string") {
      link.setAttribute("download", oldDownload);
    } else if (oldDownload === null) {
      link.removeAttribute("download");
    }
    if (typeof oldUrl === "string") {
      link.setAttribute("href", oldUrl);
    } else if (oldUrl === null) {
      link.removeAttribute("href");
    }
  }
},
FOCUS_EDITABLE: {
  258: "Select an editable area",
  activator: function(link) {
    VDom.UI.simulateSelect(link, true);
    return false;
  }
},
DEFAULT: {
  0: "Open link in current tab",
  2: "Open link in new tab",
  3: "Open link in new active tab",
  66: "Open multiple links in new tabs",
  67: "Activate link and hold on",
  activator: function(link, hint) {
    var mode, alterTarget, tag, ret, onMac = VSettings.cache.onMac;
    tag = link.nodeName.toLowerCase();
    if (tag === "iframe" || tag === "frame") {
      ret = link === Vomnibar.box ? (Vomnibar.focus(1), false)
        : this.highlightChild(link.contentWindow);
      this.mode = 0;
      return ret;
    } else if (tag === "details") {
      link.open = !link.open;
      return;
    } else if (hint.classList.contains("BH")) {
      return this.Modes.HOVER.activator.call(this, link);
    } else if ((mode = VDom.getEditableType(link)) === 3) {
      VDom.UI.simulateSelect(link, true);
      return false;
    }
    mode = this.mode & 3;
    if (mode >= 2 && tag === "a") {
      alterTarget = link.getAttribute('target');
      link.target = "_top";
    }
    // NOTE: not clear last hovered item, for that it may be a menu
    VDom.UI.click(link, {
      altKey: false,
      ctrlKey: mode >= 2 && !onMac,
      metaKey: mode >= 2 &&  onMac,
      shiftKey: mode === 3
    }, mode > 0 || link.tabIndex >= 0);
    if (alterTarget === undefined) {}
    else if (alterTarget === null) {
      link.removeAttribute("target");
    } else {
      link.setAttribute("target", alterTarget);
    }
  }
}
}
};
