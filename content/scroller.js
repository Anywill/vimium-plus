"use strict";
var VScroller = {
Core: {
  animate: null,
  calibrationBoundary: 150,
  maxCalibration: 1.6,
  minCalibration: 0.5,
  // high:  60f / 1000ms :  400ms / 24f # 600 / 28
  // low:   15f /  250ms :   33ms /  2f # 200 / 6
  maxInterval: 28,
  minDelay: 600,
  performScroll: function(el, di, amount) {
    var before;
    if (di) {
      if (el) {
        before = el.scrollTop;
        el.scrollTop += amount;
        return el.scrollTop !== before;
      } else {
        before = window.scrollY;
        window.scrollBy(0, amount);
        return window.scrollY !== before;
      }
    } else if (el) {
      before = el.scrollLeft;
      el.scrollLeft += amount;
      return el.scrollLeft !== before;
    } else {
      before = window.scrollX;
      window.scrollBy(amount, 0);
      return window.scrollX !== before;
    }
  },
  scroll: function(element, di, amount) {
    if (!amount) { return; }
    if (!VSettings.cache.smoothScroll) {
      this.performScroll(element, di, amount);
      VDom.isVisibile(VScroller.current) || (VScroller.current = element);
      return;
    }
    this.animate(amount, di, element);
  }
},

  current: null,
  keyIsDown: 0,
  Properties: [{
    axisName: "scrollLeft",
    max: "scrollWidth",
    viewSize: "clientWidth"
  }, {
    axisName: "scrollTop",
    max: "scrollHeight",
    viewSize: "clientHeight"
  }],
  scrollBy: function(di, amount, factor) {
    if (VHints.tryNestedFrame("VScroller.scrollBy", arguments)) { return; }
    var element = this.findScrollable(this.getActivatedElement(), di, amount);
    amount = !factor ? this.adjustAmount(di, amount, element)
      : factor === 1 ? (amount > 0 ? Math.ceil : Math.floor)(amount)
      : amount * this.getDimension(element, di, factor);
    this.Core.scroll(element, di, amount);
  },
  scrollTo: function(di, amount, fromMax) {
    if (VHints.tryNestedFrame("VScroller.scrollTo", arguments)) { return; }
    var element = this.findScrollable(this.getActivatedElement(), di, fromMax ? 1 : -1);
    amount = this.adjustAmount(di, amount, element);
    amount = fromMax ? this.getDimension(element, di, "max") - amount : amount;
    amount -= element ? element[this.Properties[di].axisName] : di ? window.scrollY : window.scrollX;
    this.Core.scroll(element, di, amount);
  },
  adjustAmount: function(di, amount, element) {
    amount *= VSettings.cache.scrollStepSize;
    return amount && !di && element && element.scrollWidth <= element.scrollHeight * 2
      ? Math.ceil(amount * 0.6) : amount;
  },
  findScrollable: function(element, di, amount) {
    amount = amount > 0 ? 1 : -1;
    while (element !== document.body && !(this.scrollDo(element, di, amount) && this.shouldScroll(element, di))) {
      element = element.parentElement || (element.parentNode && element.parentNode.host) || document.body;
    }
    return element === document.body ? this.selectFirst(element) : element;
  },
  getActivatedElement: function() {
    var element = this.current;
    if (element) { return element; }
    element = document.body;
    return this.current = element && (this.selectFirst(element) || element);
  },
  getDimension: function(el, di, name) {
    return !el || name !== "viewSize" || el !== document.body
        ? (el || document.documentElement)[this.Properties[di][name]]
      : di ? window.innerHeight : window.innerWidth;
  },
  scrollDo: function(element, di, amount) {
    return this.Core.performScroll(element, di, amount) && this.Core.performScroll(element, di, -amount);
  },
  selectFirst: function(element) {
    if (this.scrollDo(element, 1, 1) || this.scrollDo(element, 1, -1)) {
      return element;
    }
    VDom.prepareCrop();
    var children = [], rect, _ref = element.children, _len = _ref.length;
    while (0 < _len--) {
      element = _ref[_len];
      if (rect = VDom.getVisibleClientRect(element)) {
        children.push([(rect[2] - rect[0]) * (rect[3] - rect[1]), element]);
      }
    }
    if (_len = children.length) {
      children.sort(this.sortBy0);
      while (0 < _len--) {
        if (element = this.selectFirst(children[_len][1])) {
          return element;
        }
      }
    }
    return null;
  },
  scrollIntoView: function(el) {
    this.getActivatedElement();
    var rect = el.getClientRects()[0], amount, height, width, hasY, oldSmooth;
    if (!rect) { return; }
    height = window.innerHeight, width = window.innerWidth;
    amount = rect.bottom < 0 ? rect.bottom - Math.min(rect.height, height)
      : height < rect.top ? rect.top + Math.min(rect.height, height, 0) : 0;
    if (amount) {
      this.Core.scroll(this.findScrollable(el, 1, amount), 1, amount);
      VScroller.keyIsDown = 0;
    }
    hasY = amount;
    amount = rect.right < 0 ? rect.right - Math.min(rect.width, width)
      : width < rect.left ? rect.left + Math.min(rect.width - width, 0) : 0;
    if (!amount) { return; }
    oldSmooth = VSettings.cache.smoothScroll;
    VSettings.cache.smoothScroll = !hasY;
    el = this.findScrollable(el, 0, amount);
    this.Core.scroll(el, 0, amount);
    VSettings.cache.smoothScroll = oldSmooth;
    VScroller.keyIsDown = 0;
  },
  shouldScroll: function(element, di) {
    var st = window.getComputedStyle(element);
    return VDom.isStyleVisible(st) && (di ? st.overflowY : st.overflowX) !== "hidden";
  },
  isScrollable: function(el, di) {
    return this.scrollDo(el, di, (di ? el.scrollTop : el.scrollLeft) > 0 ? -1 : 1) && this.shouldScroll(el, di);
  },
  sortBy0: function(a, b) {
    return a[0] - b[0];
  }
};

VScroller.Core.animate = function () {
  var amount = 0, calibration = 1.0, di = 0, duration = 0, element = null, //
  sign = 0, timestamp = -1, totalDelta = 0, totalElapsed = 0.0, //
  animate = function(newTimestamp) {
    var int1 = timestamp, elapsed, continuous, _this;
    timestamp = newTimestamp;
    if (int1 === -1) {
      requestAnimationFrame(animate);
      return;
    }
    elapsed = newTimestamp - int1;
    int1 = (totalElapsed += elapsed);
    _this = VScroller.Core;
    if (continuous = VScroller.keyIsDown > 0) {
      if (int1 >= 75) {
        if (int1 > _this.minDelay) { --VScroller.keyIsDown; }
        int1 = calibration;
        if (_this.minCalibration <= int1 && int1 <= _this.maxCalibration) {
          int1 = _this.calibrationBoundary / amount / int1;
          calibration *= (int1 > 1.05) ? 1.05 : (int1 < 0.95) ? 0.95 : 1.0;
        }
      }
    }
    int1 = Math.ceil(amount * (elapsed / duration) * calibration);
    int1 = continuous ? int1 : Math.max(0, Math.min(int1, amount - totalDelta));
    if (int1 && _this.performScroll(element, di, sign * int1)) {
      totalDelta += int1;
      requestAnimationFrame(animate);
      return;
    }
    if (VScroller.current !== element) {
      VDom.isVisibile(VScroller.current) || (VScroller.current = element);
    }
    element = null;
  };
  this.animate = function(newAmount, newDi, newEl) {
    amount = Math.abs(newAmount); calibration = 1.0; di = newDi;
    duration = Math.max(100, 20 * Math.log(amount)); element = newEl;
    sign = newAmount === 0 ? 0 : newAmount < 0 ? -1 : 1;
    timestamp = -1; totalDelta = 0; totalElapsed = 0.0;
    var keyboard = VSettings.cache.keyboard;
    this.maxInterval = Math.round(keyboard[1] / 16.67) + 4;
    this.minDelay = (((keyboard[0] - keyboard[1]) / 30) | 0) * 30;
    VScroller.keyIsDown = this.maxInterval;
    requestAnimationFrame(animate);
  };
  this.animate.apply(this, arguments);
};
