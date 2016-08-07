"use strict";
VSettings.checkIfEnabled = function() {
  VPort.safePost({
    handler: "checkIfEnabled",
    url: window.location.href
  });
};

VDom.documentReady(function() {
  if (VPort.safePost({ handler: "reg", visible: true })) {
    return;
  }
  addEventListener("hashchange", VSettings.checkIfEnabled);
  VEventMode.onWndFocus(VPort.safePost.bind(VPort, {
    handler: "frameFocused"
  }, function() {
    setTimeout(function() {
      if (VPort && !VPort.port) {
        VSettings.destroy();
      }
    }, 50);
  }));
});

if (chrome.runtime.onMessageExternal) {
  VimiumInjector.alive = 1;
} else {
  VimiumInjector.alive = 0.5;
  console.log("%cVimium++%c: injected %cpartly%c into %c" + chrome.runtime.id
    , "color: red;", "color: auto;"
    , "color: red;", "color: auto;", "color: blue;");
}

VSettings.onDestroy = function() {
  removeEventListener("hashchange", VSettings.checkIfEnabled);
  if (VPort.port) {
    try {
      VPort.port.disconnect();
    } catch (e) {}
  }
  EventTarget.removeVimiumHooks && EventTarget.removeVimiumHooks();
  var injector = VimiumInjector;
  injector.alive = 0;
  injector.destroy = null;
  [].forEach.call(document.querySelectorAll(
  'script[src^="chrome-extension://hfjbmagddngcpeloejdejnfgbamkjaeg/"]'
  ), function(node) { node.remove(); });
};

VimiumInjector.destroy = VSettings.destroy;
