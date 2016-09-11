"use strict";
/* eslint-env webextensions */
(function() {
  var scriptSrc = document.currentScript.src, i = scriptSrc.indexOf("://") + 3,
  extId = scriptSrc.substring(i, scriptSrc.indexOf("/", i));
chrome.runtime.sendMessage(extId, { handler: "content_scripts" }, function(content_scripts) {
  if (!content_scripts) {
    console.log("%cVimium++%c: %cfail%c to inject into %c" + chrome.runtime.id
      , "color: red;", "color: auto;", "color: red;", "color: auto;", "color: blue;");
    if (content_scripts === null) { // disabled
      EventTarget.vimiumRemoveHooks && EventTarget.vimiumRemoveHooks();
    }
    return chrome.runtime.lastError;
  }
  /* globals VimiumInjector */
  if (window.VimiumInjector && typeof VimiumInjector.destroy === "function") {
    VimiumInjector.destroy();
  }

  window.VimiumInjector = {
    id: extId,
    alive: 0,
    destroy: null
  };
  var insertLocation = document.querySelector('script[src="' + scriptSrc + '"]') ||
        document.head.firstChild, parentElement = insertLocation.parentElement;
  content_scripts.forEach(function(src) {
    var scriptElement = document.createElementNS("http://www.w3.org/1999/xhtml", "script");
    scriptElement.async = false;
    scriptElement.defer = true;
    scriptElement.type = "text/javascript";
    scriptElement.src = src;
    parentElement.insertBefore(scriptElement, insertLocation).remove();
  });
});
})();

(function(obj) {
var cls = obj.prototype, _listen = cls.addEventListener, newListen;
if (_listen.vimiumHooked === true) { return; }

cls.addEventListener = newListen = function(type, listener, useCapture) {
  if (type === "click" && this instanceof Element) {
    this.vimiumHasOnclick = true;
  }
  return _listen.call(this, type, listener, useCapture);
};
cls.addEventListener.vimiumHooked = true;
obj.vimiumRemoveHooks = function() {
  delete obj.vimiumRemoveHooks;
  cls.addEventListener === newListen && (cls.addEventListener = _listen);
};
})(EventTarget);
