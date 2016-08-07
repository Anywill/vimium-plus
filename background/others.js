"use strict";

if (Settings.get("vimSync") === true) setTimeout(function() { if (!chrome.storage) { return; }
  var Sync = Settings.Sync = {
    storage: chrome.storage.sync,
    to_update: null,
    doNotSync: Object.setPrototypeOf({
      findModeRawQueryList: 1, keyboard: 1
    }, null),
    HandleStorageUpdate: function(changes) {
      var change, key;
      Object.setPrototypeOf(changes, null);
      for (key in changes) {
        change = changes[key];
        Sync.storeAndPropagate(key, change != null ? change.newValue : null);
      }
    },
    storeAndPropagate: function(key, value) {
      var curVal, jsonVal, defaultVal = Settings.defaults[key], notJSON;
      if (!this.shouldSyncKey(key)) { return; }
      if (value == null) {
        if (key in localStorage) {
          Settings.set(key, defaultVal);
        }
        return;
      }
      curVal = Settings.get(key);
      if (notJSON = typeof defaultVal === "string") {
        jsonVal = value;
      } else {
        jsonVal = JSON.stringify(value);
        curVal = JSON.stringify(curVal);
      }
      if (jsonVal === curVal) { return; }
      curVal = notJSON ? defaultVal : JSON.stringify(defaultVal);
      if (jsonVal === curVal) {
        value = defaultVal;
      }
      Settings.set(key, value);
    },
    set: function(key, value) {
      if (!this.shouldSyncKey(key)) { return; }
      var items = this.to_update;
      if (!items) {
        setTimeout(this.DoUpdate, 60000);
        items = this.to_update = Object.create(null);
      }
      items[key] = value;
    },
    DoUpdate: function() {
      var items = Sync.to_update, removed = [], key, left = 0;
      Sync.to_update = null;
      if (!items) { return; }
      for (key in items) {
        if (items[key] != null) {
          ++left;
        } else {
          delete items[key];
          removed.push(key);
        }
      }
      if (removed.length > 0) {
        Sync.storage.remove(removed);
      }
      if (left > 0) {
        Sync.storage.set(items);
      }
    },
    shouldSyncKey: function(key) {
      return (key in Settings.defaults) && !(key in this.doNotSync);
    }
  };
  chrome.storage.onChanged.addListener(Sync.HandleStorageUpdate);
  Sync.storage.get(null, function(items) {
    var key, value;
    if (value = chrome.runtime.lastError) { return value; }
    Object.setPrototypeOf(items, null);
    for (key in items) {
      Sync.storeAndPropagate(key, items[key]);
    }
  });
}, 400);

setTimeout(function() { if (!chrome.browserAction) { return; }
  var func = Settings.updateHooks.showActionIcon, imageData, tabIds;
  function loadImageAndSetIcon(type, path) {
    var img, i, cache = Object.create(null), count = 0,
    onerror = function() {
      console.error('Could not load action icon \'' + this.src + '\'.');
    },
    onload = function() {
      var canvas = document.createElement('canvas'), w, h, ctx;
      canvas.width = w = this.width, canvas.height = h = this.height;
      ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(this, 0, 0, w, h);
      cache[w] = ctx.getImageData(0, 0, w, h);
      if (count++) { return; }
      imageData[type] = cache;
      var arr = tabIds[type];
      delete tabIds[type];
      for (w = 0, h = arr.length; w < h; w++) {
        g_requestHandlers.SetIcon(arr[w], type);
      }
    };
    Object.setPrototypeOf(path, null);
    for (i in path) {
      img = new Image();
      img.onload = onload, img.onerror = onerror;
      img.src = path[i];
    }
  }
  Settings.SetIconBuffer = function(enabled) {
    if (!enabled) { return imageData = tabIds = null; }
    if (imageData) { return; }
    imageData = Object.create(null);
    tabIds = Object.create(null);
  };
  g_requestHandlers.SetIcon = function(tabId, type) {
    var data, path;
    if (data = imageData[type]) {
      chrome.browserAction.setIcon({
        tabId: tabId,
        imageData: data
      });
    } else if (tabIds[type]) {
      tabIds[type].push(tabId);
    } else if (path = Settings.icons[type]) {
      setTimeout(loadImageAndSetIcon, 0, type, path);
      tabIds[type] = [tabId];
    }
  };
  Settings.updateHooks.showActionIcon = function (value) {
    func.call(this, value);
    Settings.SetIconBuffer(value);
    if (value) {
      chrome.browserAction.setTitle && chrome.browserAction.setTitle({
        title: "Vimium++"
      });
      chrome.browserAction.enable();
    } else {
      chrome.browserAction.disable();
      chrome.browserAction.setTitle && chrome.browserAction.setTitle({
        title: "Vimium++\nThis icon is not in use"
      });
    }
  };
  Settings.postUpdate("showActionIcon");
}, 150);

setTimeout(function() { if (!chrome.omnibox) { return; }
  var last, firstUrl, lastSuggest, spanRe = /<(\/?)span(?: [^>]+)?>/g,
  tempRequest, timeout = 0, sessionIds, suggestions = null, outTimeout = 0, outTime,
  defaultSug = { description: "<dim>Open: </dim><url>%s</url>" },
  defaultSuggestionType = 0, notOnlySearch = true,
  formatSessionId = function(sug) {
    if (sug.sessionId != null) {
      sessionIds[sug.url] = sug.sessionId;
    }
  },
  format = function(sug) {
    var str;
    if (sug.description) {
      str = sug.description;
    } else {
      str = "<url>" + sug.textSplit.replace(spanRe, "<$1match>");
      str += sug.title ? "</url><dim> - " + Utils.escapeText(sug.title) + "</dim>"
        : "</url>";
    }
    return {
      content: sug.url,
      description: str
    };
  },
  clean = function() {
    firstUrl = "";
    last = sessionIds = tempRequest = suggestions = null;
    if (lastSuggest) {
      lastSuggest.isOff = true;
      lastSuggest = null;
    }
    if (outTimeout) {
      clearTimeout(outTimeout);
      outTime = outTimeout = 0;
    }
  },
  outClean = function() {
    if (Date.now() - outTime > 5000) {
      clean();
    } else {
      outTimeout = setTimeout(outClean, 30000);
    }
  },
  onTimer = function() {
    timeout = 0;
    var arr;
    if (arr = tempRequest) {
      tempRequest = null;
      onInput(arr[0], arr[1]);
    }
  },
  onComplete = function(suggest, response, autoSelect) {
    if (!lastSuggest || suggest.isOff) { return; }
    if (suggest === lastSuggest) { lastSuggest = null; }
    var sug = response[0];
    if (sug && "sessionId" in sug) {
      sessionIds = Object.create(null);
      response.forEach(formatSessionId);
    }
    if (autoSelect) {
      firstUrl = sug.url;
      response.shift();
    }
    notOnlySearch = true;
    if (!autoSelect) {
      if (defaultSuggestionType !== 1) {
        chrome.omnibox.setDefaultSuggestion(defaultSug);
        defaultSuggestionType = 1;
      }
    } else if (sug.type === "search") {
      notOnlySearch = response.length > 0;
      var text = sug.titleSplit.replace(spanRe, "");
      text = Utils.escapeText(text.substring(0, text.indexOf(":")));
      text = "<dim>" + text + " - </dim><url>" +
        sug.textSplit.replace(spanRe, "<$1match>") + "</url>";
      defaultSuggestionType = 2;
      chrome.omnibox.setDefaultSuggestion({ description: text });
      if (sug = response[0]) switch (sug.type) {
      case "math":
        sug.description = "<dim>" + sug.textSplit.replace(spanRe, "")
          + " = </dim><url><match>" + sug.title + "</match></url>";
        break;
      }
    } else {
      defaultSuggestionType = 3;
      chrome.omnibox.setDefaultSuggestion({ description: format(sug).description });
    }
    response = response.map(format);
    suggest(suggestions = response);
    outTimeout || setTimeout(outClean, 30000);
  },
  onInput = function(key, suggest) {
    key = key.trim();
    if (key === last) { suggestions && suggest(suggestions); return; }
    lastSuggest && (lastSuggest.isOff = true);
    var onlySearch = false;
    if (timeout) {
      tempRequest = [key, suggest];
      return;
    } else if (suggestions && suggestions.length === 0 && key.startsWith(last) && !/^:[a-z]?$/.test(last)) {
      if (notOnlySearch) { return suggest([]); }
      onlySearch = true;
    }
    timeout = setTimeout(onTimer, 300);
    outTime = Date.now();
    firstUrl = "";
    sessionIds = suggestions = null;
    last = key;
    lastSuggest = suggest;
    (onlySearch ? Completers.search : Completers.omni).filter(key, {
      maxResults: 6
    }, onComplete.bind(null, suggest));
  },
  onEnter = function(text, disposition) {
    text = text.trim();
    if (tempRequest && tempRequest[0] === text) {
      tempRequest = [text, onEnter.bind(null, text, disposition)];
      onTimer();
      return;
    } else if (lastSuggest) {
      return;
    }
    if (firstUrl && text === last) { text = firstUrl; }
    var sessionId = sessionIds && sessionIds[text];
    clean();
    if (sessionId != null) {
      g_requestHandlers.gotoSession({ sessionId: sessionId });
      return;
    }
    g_requestHandlers.openUrl({
      url: text,
      reuse: (disposition === "currentTab" ? 0
        : disposition === "newForegroundTab" ? -1 : -2)
    });
  };
  chrome.omnibox.onInputChanged.addListener(onInput);
  chrome.omnibox.onInputEntered.addListener(onEnter);
  chrome.omnibox.onInputCancelled.addListener(clean);
}, 600);

// According to tests: onInstalled will be executed after 0 ~ 16 ms if needed
chrome.runtime.onInstalled.addListener(window.b = function(details) {
  var reason = details.reason;
  if (reason === "install") { reason = ""; }
  else if (reason === "update") { reason = details.previousVersion; }
  else { return; }

setTimeout(function() {
  chrome.tabs.query({
    status: "complete"
  }, function(tabs) {
    var _i = tabs.length, tabId, _j, _len, callback, url, t = chrome.tabs, ref, contentScripts, js;
    callback = function() { return chrome.runtime.lastError; };
    contentScripts = chrome.runtime.getManifest().content_scripts[0];
    ref = {file: "", allFrames: contentScripts.all_frames};
    js = contentScripts.js;
    for (_len = js.length - 1; 0 <= --_i; ) {
      url = tabs[_i].url;
      if (url.startsWith("chrome") || url.indexOf("://") === -1) continue;
      tabId = tabs[_i].id;
      for (_j = 0; _j < _len; ++_j) {
        ref.file = js[_j];
        t.executeScript(tabId, ref, callback);
      }
    }
    function now() {
      return new Date(Date.now() - new Date().getTimezoneOffset() * 1000 * 60
        ).toJSON().substring(0, 19).replace('T', ' ');
    }
    console.log("%cVimium++%c has %cinstalled%c with %O at %c%s%c .", "color:red", "color:auto"
      , "color:blue", "color:auto;", details, "color:#1c00cf", now(), "color:auto");
  });

  if (!reason) { return; }

  function compareVersion(versionA, versionB) {
    var a, b, i, _ref;
    versionA = versionA.split('.');
    versionB = versionB.split('.');
    for (i = 0, _ref = Math.max(versionA.length, versionB.length); i < _ref; ++i) {
      a = parseInt(versionA[i] || 0, 10);
      b = parseInt(versionB[i] || 0, 10);
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      }
    }
    return 0;
  }
  if (compareVersion(Settings.CONST.CurrentVersion, reason) <= 0) { return; }

  reason = "vimium++_upgradeNotification";
  chrome.notifications && chrome.notifications.create(reason, {
    type: "basic",
    iconUrl: location.origin + "/icons/icon128.png",
    title: "Vimium++ Upgrade",
    message: "Vimium++ has been upgraded to version " + Settings.CONST.CurrentVersion
      + ". Click here for more information.",
    isClickable: true
  }, function(notificationId) {
    if (chrome.runtime.lastError) {
      chrome.notifications = null;
      return chrome.runtime.lastError;
    }
    reason = notificationId || reason;
    chrome.notifications.onClicked.addListener(function(id) {
      if (id !== reason) { return; }
      g_requestHandlers.focusOrLaunch({
        url: "https://github.com/gdh1995/vimium-plus#release-notes"
      });
    });
    chrome.notifications = null;
  });
}, 500);
});

setTimeout(function() {
  chrome.runtime.onInstalled.removeListener(window.b);
  window.b = null;

  document.head.remove();
  document.body.remove();
}, 200);

//* #if DEBUG
var a, b, c, cb, log;
cb = function(b) { a = b; console.log(b); };
setTimeout(function() {
  a = c = null; b = cb;
  log = console.log.bind(console);
}, 2000); // #endif */
