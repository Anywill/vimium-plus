"use strict";
var Exclusions = {
  testers: null,
  getRe: function(pattern) {
    var func = this.testers[pattern], re;
    if (func) { return func; }
    if (pattern[0] === '^' && (re = Utils.makeRegexp(pattern, "", false))) {
      func = re.test.bind(re);
    } else {
      func = this._startsWith.bind(pattern.substring(1));
    }
    return this.testers[pattern] = func;
  },
  _startsWith: function(url) {
    return url.startsWith(this);
  },
  _listening: false,
  _listeningHash: false,
  onlyFirstMatch: false,
  rules: [],
  setRules: function(rules) {
    var onURLChange;
    if (rules.length === 0) {
      this.rules = [];
      this.getPattern = function() { return null; };
      if (this._listening && (onURLChange = this.getOnURLChange())) {
        chrome.webNavigation.onHistoryStateUpdated.removeListener(onURLChange);
        if (this._listeningHash) {
          this._listeningHash = false;
          chrome.webNavigation.onReferenceFragmentUpdated.removeListener(onURLChange);
        }
      }
      this._listening = false;
      return;
    }
    this.testers || (this.testers = Object.create(null));
    this.rules = this.format(rules);
    this.onlyFirstMatch = Settings.get("exclusionOnlyFirstMatch");
    this.testers = null;
    this.getPattern = this._getPattern;
    if (this._listening) { return; }
    this._listening = true;
    onURLChange = this.getOnURLChange();
    if (!onURLChange) { return; }
    chrome.webNavigation.onHistoryStateUpdated.addListener(onURLChange);
    if (Settings.get("exclusionListenHash") && !this._listeningHash) {
      this._listeningHash = true;
      chrome.webNavigation.onReferenceFragmentUpdated.addListener(onURLChange);
    }
  },
  getPattern: null,
  _getPattern: function(url) {
    var rules = this.rules, _i, _len, matchedKeys = "", str;
    for (_i = 0, _len = rules.length; _i < _len; _i += 2) {
      if (rules[_i](url)) {
        str = rules[_i + 1];
        if (!str) { return ""; }
        matchedKeys += str;
        if (this.onlyFirstMatch) { break; }
      }
    }
    return matchedKeys || null;
  },
  getOnURLChange: function() {
    var onURLChange = !chrome.webNavigation ? null
      : Settings.CONST.ChromeVersion >= 41 ? g_requestHandlers.checkIfEnabled
      : function(details) {
        var ref = Settings.indexPorts(details.tabId), i, msg = { name: "checkIfEnabled" };
        // force the tab's ports to reconnect and refresh their pass keys
        for (i = ref && ref.length; 0 < --i; ) {
          ref[i].postMessage(msg);
        }
      };
    this.getOnURLChange = function() { return onURLChange; };
    return onURLChange;
  },
  format: function(rules) {
    var _i, _len, rule, out = [];
    for (_i = 0, _len = rules.length; _i < _len; _i++) {
      rule = rules[_i];
      out.push(this.getRe(rule.pattern), rule.passKeys);
    }
    return out;
  },
  getTemp: function(url, rules) {
    var old = this.rules;
    this.rules = this.format(rules);
    url = this._getPattern(url);
    this.rules = old;
    return url;
  },
  RefreshStatus: function(old_is_empty) {
    var ref = Settings.indexPorts(), tabId, frames
      , needIcon = Settings.get("showActionIcon")
      , i, always_enabled, pass, status = "enabled", status0, port;
    always_enabled = Exclusions.rules.length > 0 ? null : {
      name: "reset",
      passKeys: null
    };
    if (old_is_empty) {
      always_enabled || Settings.broadcast({
        name: "checkIfEnabled"
      });
      return;
    } else if (always_enabled && Settings.SetIconBuffer) {
      needIcon = true;
      Settings.SetIconBuffer(true);
      setTimeout(function() {
        Settings.SetIconBuffer(Settings.get("showActionIcon"));
      }, 60);
    }
    for (tabId in ref) {
      frames = ref[tabId];
      status0 = frames[0].sender.status;
      for (i = frames.length; 0 < --i; ) {
        port = frames[i];
        if (always_enabled) {
          if (port.sender.status === "enabled") {
            continue;
          }
        } else {
          pass = Exclusions.getPattern(port.sender.url);
          status = pass === null ? "enabled" : pass ? "partial" : "disabled";
          if (!pass && port.sender.status === status) {
            continue;
          }
        }
        port.postMessage(always_enabled || { name: "reset", passKeys: pass });
        port.sender.status = status;
      }
      if (needIcon && status0 !== (status = frames[0].sender.status)) {
        g_requestHandlers.SetIcon(tabId | 0, status);
      }
    }
  }
};

Settings.updateHooks.exclusionRules = function(rules) {
  g_requestHandlers.esc();
  setTimeout(function() {
    var is_empty = Exclusions.rules.length <= 0;
    Exclusions.setRules(rules);
    setTimeout(Exclusions.RefreshStatus, 17, is_empty);
  }, 17);
};

Settings.updateHooks.exclusionOnlyFirstMatch = function(value) {
  Exclusions.onlyFirstMatch = value;
};

Settings.updateHooks.exclusionListenHash = function(value) {
  var _this = Exclusions, onURLChange;
  if (!_this._listening) { return; }
  onURLChange = _this.getOnURLChange();
  if (!onURLChange) { return; }
  _this._listeningHash = value;
  chrome.webNavigation.onReferenceFragmentUpdated[
      value ? "addListener" : "removeListener"](onURLChange);
};

Exclusions.setRules(Settings.get("exclusionRules"));
Settings.Init();
