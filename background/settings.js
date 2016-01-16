"use strict";
var Settings = {
  __proto__: null,
  cache: Object.create(null),
  bufferToLoad: null,
  frameIdsForTab: null,
  keyToSet: [],
  timerForSet: 0,
  urlForTab: null,
  extIds: null,
  get: function(key, forCache) {
    if (key in this.cache) {
      return this.cache[key];
    }
    var value = !(key in localStorage) ? this.defaults[key]
        : (key in this.NonJSON) ? localStorage[key]
        : JSON.parse(localStorage[key]);
    if (forCache) {
      this.cache[key] = value;
    }
    return value;
  },
  set: function(key, value) {
    var ref;
    this.cache[key] = value;
    if (key in this.nonPersistent) {
    } else if (value === this.defaults[key]) {
      delete localStorage[key];
      this.Sync.clear(key);
    } else {
      this.Sync.set(key, localStorage[key] = (key in this.NonJSON)
        ? value : JSON.stringify(value));
    }
    if (ref = this.updateHooks[key]) {
      ref.call(this, value, key);
    }
  },
  postUpdate: function(key, value) {
    this.updateHooks[key].call(this, value !== undefined ? value : this.get(key), key);
  },
  updateHooks: {
    __proto__: null,
    broadcast: function (request) {
      chrome.tabs.query(request.onReady ? {status: "complete"} : {},
      function(tabs) {
        for (var i = tabs.length, t = chrome.tabs, req = request; 0 <= --i; ) {
          t.sendMessage(tabs[i].id, req, null);
        }
      });
      var r = chrome.runtime, arr = Settings.extIds, i, req;
      req = {"vimium++": {request: request}};
      // NOTE: injector only begin to work when dom is ready
      for (i = arr.length; 1 <= --i; ) {
        r.sendMessage(arr[i], req, null);
      }
    },
    bufferToLoad: function() {
      var _i, key, ref = this.valuesToLoad, ref2;
      ref2 = this.bufferToLoad = Object.create(null);
      for (_i = ref.length; 0 <= --_i;) {
        key = ref[_i];
        ref2[key] = this.get(key);
      }
    },
    files: function() {
      var files = this.files, id;
      for (id in files) {
        Utils.fetchHttpContents(files[id], this.set.bind(this, id));
      }
    },
    newTabUrl: function(url) {
      url = /^\/?pages\/\S[\S ]*.html?\b/.test(url)
        ? chrome.runtime.getURL(url) : Utils.convertToUrl(url);
      this.set('newTabUrl_f', url);
    },
    searchEngines: function() {
      this.set("searchEngineMap", Object.create(null));
    },
    searchEngineMap: function(value) {
      Utils.parseSearchEngines("~:" + this.get("searchUrl"), value);
      var rules = Utils.parseSearchEngines(this.get("searchEngines"), value);
      this.set("searchEngineRules", rules);
    },
    searchUrl: function(str) {
      var map, obj, ind;
      if (str) {
        Utils.parseSearchEngines("~:" + str, map = this.cache.searchEngineMap);
        obj = map["~"];
        str = obj.url.replace(Utils.spacesRe, "%20");
        if (obj.name) { str += " " + obj.name; }
        if (str !== arguments[0]) {
          this.set("searchUrl", str);
          return;
        }
      } else if (str = this.get("newTabUrl_f", true)) {
        this.updateHooks.newTabUrl_f(str);
        return;
      } else {
        str = this.get("searchUrl");
        ind = str.indexOf(" ");
        if (ind > 0) { str = str.substring(0, ind); }
        this.get("searchEngineMap", true)["~"] = { url: str };
      }
      this.postUpdate("newTabUrl");
    },
    baseCSS: function(css) {
      css += this.get("userDefinedCss");
      this.set("innerCss", css);
    },
    vimSync: function() {
      window.location.reload();
    },
    userDefinedCss: function() {
      this.postUpdate("baseCSS");
      this.postUpdate("broadcast", {
        name: "insertInnerCss",
        onReady: true,
        css: this.cache.innerCss
      });
    },
    userDefinedOuterCss: function(css) {
      this.postUpdate("broadcast", {
        name: "insertCSS",
        onReady: true,
        css: css
      });
    }
  },
  printStats: function() {
    Utils.require("jStat", "jstat.js").then(function(j$) {
      var mat = j$(Settings.stats).transpose(), out = {}, i, k,
      keys = ["min", "mean", "max", "stdev"];
      for (i in keys) { k = keys[i]; out[k] = mat[k](); }
      console.table(out);
      console.log(j$.histogram(Settings.stats[0], 10));
      console.log(j$.histogram(Settings.stats[1], 10));
    });
  },
  // clear localStorage & sync, if value === @defaults[key]
  defaults: {
    __proto__: null,
    UILanguage: null,
    deepHints: false,
    exclusionRules: [{pattern: "^https?://mail.google.com/", passKeys: ""}],
    findModeRawQuery: "",
    grabBackFocus: true,
    hideHud: false,
    isClickListened: true,
    keyboard: [500, 33],
    keyMappings: "",
    linkHintCharacters: "sadjklewcmpgh",
    newTabUrl: "",
    nextPatterns: "\u4e0b\u9875,\u4e0b\u4e00\u9875,\u4e0b\u4e00\u7ae0,\u540e\u4e00\u9875"
      + ",next,more,newer,>,\u2192,\xbb,\u226b,>>",
    previousPatterns: "\u4e0a\u9875,\u4e0a\u4e00\u9875,\u4e0a\u4e00\u7ae0,\u524d\u4e00\u9875"
      + ",prev,previous,back,older,<,\u2190,\xab,\u226a,<<",
    regexFindMode: false,
    scrollStepSize: 100,
    searchUrl: "http://www.baidu.com/s?ie=utf-8&wd=$s Baidu",
    searchEngines: "b|ba|baidu|Baidu: www.baidu.com/s?ie=utf-8&wd=$s \u767e\u5ea6\n\
g|go|gg|google|Google: http://www.google.com/search?q=$s Google\n\
js\\:|Js: javascript:\\ $S; Javascript\n\
w|wiki:\\\n  http://www.wikipedia.org/w/index.php?search=$s Wikipedia (en-US)",
    searchEngineMap: {}, // may be modified, but this action is safe
    showActionIcon: true,
    showAdvancedCommands: false,
    showAdvancedOptions: false,
    showOmniRelevancy: false,
    smoothScroll: true,
    userDefinedCss: "",
    userDefinedOuterCss: "",
    vimSync: false
  },
  NonJSON: {
    __proto__: null, findModeRawQuery: 1,
    keyMappings: 1, linkHintCharacters: 1,
    newTabUrl: 1, newTabUrl_f: 1, nextPatterns: 1, previousPatterns: 1,
    searchEngines: 1, searchUrl: 1, userDefinedCss: 1, userDefinedOuterCss: 1
  },
  // not set localStorage, neither sync, if key in @nonPersistent
  // not clean if exists (for simpler logic)
  nonPersistent: { __proto__: null,
    baseCSS: 1, exclusionTemplate: 1, helpDialog: 1, innerCss: 1,
    searchEngineMap: 1, searchEngineRules: 1, settingsVersion: 1, vomnibar: 1
  },
  files: {
    __proto__: null,
    baseCSS: "front/vimium.min.css",
    exclusionTemplate: "front/exclusions.html",
    helpDialog: "front/help_dialog.html",
    vomnibar: "front/vomnibar.html"
  },
  icons: {
    __proto__: null,
    disabled: { "19": "icons/disabled_19.png", "38": "icons/disabled_38.png" },
    enabled: { "19": "icons/enabled_19.png", "38": "icons/enabled_38.png" },
    partial: { "19": "icons/partial_19.png", "38": "icons/partial_38.png" }
  },
  valuesToLoad: ["deepHints" //
    , "findModeRawQuery" //
    , "grabBackFocus", "hideHud", "isClickListened", "keyboard" //
    , "linkHintCharacters", "nextPatterns", "previousPatterns" //
    , "regexFindMode", "scrollStepSize", "smoothScroll" //
  ],
  stats: [[], []],
  Sync: null,
  CONST: {
    ChromeInnerNewTab: "chrome-search://local-ntp/local-ntp.html", // should keep lower case
    ChromeVersion: 37, ContentScripts: null, CurrentVersion: "",
    OnMac: false, OptionsPage: "", Timer: 0
  }
};

// note: if changed, ../pages/newtab.js also needs change.
Settings.defaults.newTabUrl = Settings.CONST.ChromeInnerNewTab;

(function() {
  var ref, i, func = chrome.runtime.getURL;
  ref = chrome.runtime.getManifest();
  Settings.CONST.CurrentVersion = ref.version;
  Settings.CONST.OptionsPage = func(ref.options_page);
  ref = ref.content_scripts[0].js;
  ref[ref.length - 1] = "content/inject_end.js";
  ref = ref.map(function(path) { return func(path); });
  Settings.CONST.ContentScripts = {js: ref};

  i = navigator.appVersion.match(/Chrom(?:e|ium)\/([^\s]*)/)[1];
  Settings.CONST.ChromeVersion = parseFloat(i);

  func = function() {};
  Settings.Sync = {clear: func, set: func};
  Settings.extIds = [chrome.runtime.id];
})();

chrome.runtime.getPlatformInfo(function(info) {
  Settings.CONST.OnMac = info.os === "mac";
});
