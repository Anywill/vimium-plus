"use strict";
(function(func) {
  var d = document, script = d.createElement("script"), installer, onclick, box;
  if (!(script instanceof HTMLScriptElement)) { return; }
  addEventListener("VimiumReg", installer = function(event) {
    removeEventListener("VimiumReg", installer, true);
    box = event.target;
    box.addEventListener("VimiumOnclick", onclick, true);
    installer = null;
  }, true);
  addEventListener("VimiumOnclick", onclick = function(event) {
    event.target.vimiumHasOnclick = true;
    event.stopPropagation();
  }, true);
  /* globals VSettings: false */
  VSettings.onDestroy = function() {
    removeEventListener("VimiumReg", installer, true);
    removeEventListener("VimiumOnclick", onclick, true);
    box && box.removeEventListener("VimiumOnclick", onclick, true);
  };
  script.type = "text/javascript";
  script.textContent = '"use strict";(' + func.toString() + ')();';
  d = d.documentElement || d;
  d.insertBefore(script, d.firstChild).remove();
})(function() {
var _listen, box, handler, reg, register, toRegister, timeout;

_listen = EventTarget.prototype.addEventListener;
toRegister = [];
register = toRegister.push.bind(toRegister);
EventTarget.prototype.addEventListener = function(type, listener, useCapture) {
  if (type === "click" && this instanceof Element) {
    register(this);
  }
  return _listen.call(this, type, listener, useCapture);
};

handler = function() {
  removeEventListener("DOMContentLoaded", handler, true);
  clearTimeout(timeout);
  box = document.createElement("div");
  document.documentElement.appendChild(box);
  box.dispatchEvent(new CustomEvent("VimiumReg"));
  box.remove();
  register = reg;
  for (var i = toRegister.length; 0 <= --i; ) { register(toRegister[i]); }
  handler = toRegister = reg = null;
};
_listen("DOMContentLoaded", handler, true);
timeout = setTimeout(handler, 1000);

reg = setTimeout.bind(null, function(element) {
  var e1, e2, event;
  event = new CustomEvent("VimiumOnclick");
  if (document.contains(element)) {
    element.dispatchEvent(event);
    return;
  }
  for (e1 = element; (e2 = e1.parentElement) != null; e1 = e2) {}
  if (e1.parentNode != null) { return; }
  // NOTE: ignore nodes belonging to a shadowRoot
  box.appendChild(e1);
  element.dispatchEvent(event);
  e1.remove();
}, 0);
});
