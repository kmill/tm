// keys.js

'use strict';

///Keyboard

var keyCodeMap = [
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', null, null, null, null, null, null,
    null, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', null, null, null, null, null,
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '+', null, '-', '.', '/',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, ';', '=', ',', '-', '.', '/',
    '`', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, '[', '\\', ']', "'", null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
];

var keyShiftCodeMap = [
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ')', '!', '@', '#', '$', '%', '^', '&', '*', '(', null, null, null, null, null, null,
    null, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, ':', '+', '<', '_', '>', '?',
    '~', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, '{', '|', '}', '"', null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
];

var shiftedKey = {"'": '"', '-': '_', ',': '<', '/': '?', '.': '>', '1': '!', '0': ')', '3': '#', '2': '@', '5': '%', '4': '$', '7': '&', '6': '^', '9': '(', '8': '*', ';': ':', '=': '+', '[': '{', ']': '}', '\\': '|', 'a': 'A', '`': '~', 'c': 'C', 'b': 'B', 'e': 'E', 'd': 'D', 'g': 'G', 'f': 'F', 'i': 'I', 'h': 'H', 'k': 'K', 'j': 'J', 'm': 'M', 'l': 'L', 'o': 'O', 'n': 'N', 'q': 'Q', 'p': 'P', 's': 'S', 'r': 'R', 'u': 'U', 't': 'T', 'w': 'W', 'v': 'V', 'y': 'Y', 'x': 'X', 'z': 'Z'};

keyCodeMap[8] = '<backspace>';
keyCodeMap[9] = '<tab>';
keyCodeMap[13] = '<return>';
keyCodeMap[27] = '<esc>';
keyCodeMap[32] = '<space>';
keyCodeMap[33] = '<pageup>';
keyCodeMap[34] = '<pagedown>';
keyCodeMap[35] = '<end>';
keyCodeMap[36] = '<home>';
keyCodeMap[37] = '<left>';
keyCodeMap[38] = '<up>';
keyCodeMap[39] = '<right>';
keyCodeMap[40] = '<down>';
keyCodeMap[45] = '<insert>';
keyCodeMap[46] = '<delete>';

function GlobalKeyHandler(initGlobalKeys) {
  this.globalKeyMap = initGlobalKeys || {};
  this._keymaps = [this.globalKeyMap];
  var self = this;
  $(window).on("keydown", function (e) {
    self.handleKey(e);
  });
}
GlobalKeyHandler.prototype.pushKeyMap = function (map) {
  this._keymaps.push(map);
};
GlobalKeyHandler.prototype.popKeyMap = function () {
  if (this._keymaps.length > 1) {
    return this._keymaps.pop();
  } else {
    throw new Error("More pops than pushes");
  }
};
GlobalKeyHandler.prototype.lookup = function (chord) {
  for (var i = this._keymaps.length - 1; i >= 0; i--) {
    if (_.has(this._keymaps[i], chord)) {
      return this._keymaps[i][chord];
    }
  }
  return null;
};
GlobalKeyHandler.prototype.handleKey = function (e) {
  if (e.type === "keydown") {
    var modifier = [];
    var key = null;
    if (e.ctrlKey) { modifier.push("C"); }
    if (e.altKey || e.metaKey) { modifier.push("M"); }
    if (e.shiftKey) {
      key = keyShiftCodeMap[e.keyCode];
      if (key === null) {
                modifier.push("S");
      }
    }
    if (key === null) {
      key = keyCodeMap[e.keyCode];
    }
    if (key !== null) {
      var chord = modifier.concat(key).join('-');
      var command = this.lookup(chord);
      if (command) {
        command(e, chord);
      }
    }
  }
};
