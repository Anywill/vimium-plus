"use strict";
var VKeyCodes = {
  __proto__: null,
  altKey: 18, backspace: 8, ctrlKey: 17, deleteKey: 46, down: 40,
  enter: 13, esc: 27, f1: 112, f12: 123, left: 37, menuKey: 93, metaKey: 91,
  pageup: 33, right: 39, shiftKey: 16, space: 32, tab: 9, up: 38
},
VKeyboard = {
  onMac: false,
  keyNames: {
    __proto__: null, 32: "space",
    33: "pageup", 34: "pagedown", 35: "end", 36: "home",
    37: "left", 38: "up", 39: "right", 40: "down",
    112: "f1", 113: "f2", 114: "f3", 115: "f4", 116: "f5", 117: "f6",
    118: "f7", 119: "f8", 120: "f9", 121: "f10", 122: "f11", 123: "f12"
  },
  correctionMap: {
    __proto__: null,
    0: ";:", 1: "=+", 2: ",<", 3: "-_", 4: ".>", 5: "/?", 6: "`~",
    33: "[{", 34: "\\|", 35: "]}", 36: "'\""
  },
  getKeyName: function(event) {
    var keyChar;
    if (keyChar = this.keyNames[event.keyCode]) {
      return event.shiftKey ? keyChar.toUpperCase() : keyChar;
    }
    return "";
  },
  getKeyCharUsingKeyIdentifier: function(event) {
    var keyIdentifier = event.keyIdentifier, keyId;
    if (! keyIdentifier.startsWith("U+")) {
      return this.getKeyName(event);
    }
    keyId = parseInt(keyIdentifier.substring(2), 16);
    if (keyId < 65) {
      return keyId <= 32 ? (keyId !== 32 ? "" : event.shiftKey ? "SPACE" : "space")
      : (event.shiftKey && keyId >= 48 && keyId < 58) ? ")!@#$%^&*("[keyId - 48]
      : String.fromCharCode(keyId);
    } else if (keyId <= 90) {
      return String.fromCharCode(keyId + (event.shiftKey ? 0 : 32));
    } else if (keyId <= 125) {
      return "";
    } else {
      return (keyIdentifier = this.correctionMap[keyId - 186])
        ? keyIdentifier[event.shiftKey ? 1 : 0] : "";
    }
  },
  getKeyChar: function(event) {
    var key;
    if (!event.key) { return this.getKeyCharUsingKeyIdentifier(event); }
    if (key = this.getKeyName(event)) { return key; }
    return (key = event.key).length === 1 ? key : "";
  },
  getKey: function(event, ch) {
    var left = event.metaKey ? "<m-" : "<";
    return event.ctrlKey ? left + (event.altKey ? "c-a-" : "c-") + ch + ">"
      : event.altKey ? left + "a-" + ch + ">"
      : event.metaKey || ch.length > 1 ? left + ch + ">" : ch;
  },
  getKeyStat: function() {
    return event.altKey | (event.ctrlKey << 1) | (event.metaKey << 2) | (event.shiftKey << 3);
  },
  isPlain: function(event) {
    return !(event.shiftKey || event.ctrlKey || event.altKey || event.metaKey);
  }
};
