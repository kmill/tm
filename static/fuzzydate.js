// fuzzydate.js

"use strict";

var FuzzyDate = (function () {
  var months = [
    ["jan", 1],
    ["feb", 2],
    ["mar", 3],
    ["apr", 4],
    ["may", 5],
    ["jun", 6],
    ["jul", 7],
    ["aug", 8],
    ["sep", 9],
    ["oct", 10],
    ["nov", 11],
    ["dec", 12]
  ];
  var week = ["su", "mo", "tu", "we", "th", "fr", "sa"];
//  var week2 = [null, "m", "t", "w", "h", "f", null];

  function make_lexer(descrs) {
    return {
      tokenize : function (s) {
        var tokens = [];
        var i = 0;
        while (i < s.length) {
          for (var j = 0; j < descrs.length; j++) {
            var descr = descrs[j];
            descr[0].lastIndex = i;
            var match = descr[0].exec(s);
            if (match && match.index === i) {
              if (descr[1] === null) {
                // nothing
              } else if (typeof descr[1] === "function") {
                tokens.push(descr[1](match));
              } else if (typeof descr[1] === "number") {
                tokens.push([match[descr[1]]]);
              } else if (typeof descr[1] === "string") {
                tokens.push([descr[1], match[descr[2]]]);
              } else {
                throw new Error("bad lexer description " + descr);
              }
              i += match[0].length;
              break;
            }
          }
          if (j === descrs.length) {
            i++; // maybe just a bad character?
          }
        }
        return tokens;
      }
    };
  }

  function figure_ymd(a, b, c) {
    if (a > 99) { // definitely year
      return ['ymd', a, b, c];
    } else if (a > 12) { // hmm... the month slot looks like a day
      return ['ymd', c, b, a];
    } else {
      return ['ymd', c, a, b];
    }
  }

  function figure_md(a, b) {
    if (b > 99) {
      return ['ym', b, a];
    } else if (a > 99) {
      return ['ym', a, b];
    } else if (a > 12) {
      return ['md', b, a];
    } else {
      return ['md', a, b];
    }
  }

  var lexer = make_lexer([
    [/(\s|,)+/ig, null],
    [/\+|-/ig, 0],
//    [/(\d+)(st|nd|rd|th)/g, function (m) { return ['daynum', m[1]]; }],

    [/(\d+):(\d+):(\d+)/ig, function (m) { return ['hms', +m[1], +m[2], +m[3]]; }],
    [/(\d+):(\d+)/ig, function (m) { return ['hm', +m[1], +m[2]]; }],

    [/(\d+)\/(\d+)\/(\d+)/ig, function (m) { return figure_ymd(+m[1], +m[2], +m[3]); }],
    [/(\d+)\/(\d+)/ig, function (m) { return figure_md(+m[1], +m[2]); }],

    [/(\d+)-(\d+)-(\d+)/ig, function (m) { return figure_ymd(+m[1], +m[2], +m[3]); }],
    [/(\d+)-(\d+)/ig, function (m) { return figure_md(+m[1], +m[2]); }],

    [/\d+/ig, function (m) { return ['num', +m[0]]; }],
    [/[^\s,\+\-\d]+/ig, 'word', 0]
  ]);

  function tokenize(s) {
    return lexer.tokenize(s.toLowerCase());
  }

  function fixYear(y) {
    if (y < 100) {
      return y + 2000; // good enough for me!
    } else {
      return y;
    }
  }

  var am = /^a\.?m?\.?$/;
  var pm = /^p\.?m?\.?$/;

  function parse(s, rel) {
    var parts = tokenize(s);
    if (rel === void 0) {
      rel = new Date();
    }

    function typ(i) {
      if (i < parts.length) {
        return parts[i][0];
      } else {
        return null;
      }
    }

    function fillYear() {
      if (y === null) {
        if (rel.getMonth() + 1 <= m + 1) {
          y = rel.getFullYear();
        } else {
          y = rel.getFullYear() + 1;
        }
      }
    }

    function fillDate() {
      if (m === null) {
        m = rel.getMonth() + 1;
      }
      fillYear();
      if (d === null) {
        d = rel.getDate();
      }
    }

    function fillTime() {
      fillDate();
      if (hr === null) {
        hr = rel.getHours();
      }
      if (min === null) {
        min = rel.getMinutes();
      }
    }

    function doDay(day, weekOffset) {
      if (m === null) {
        m = rel.getMonth() + 1;
      }
      fillYear();
      d = rel.getDate() + day - rel.getDay() + weekOffset * 7;
    }

    function parseOffset(offset) {
      if (typ(i) === 'num') {
        offset = offset * parts[i][1];
        i++;
      }
      fillDate();
      if (typ(i) === "word") {
        var w = parts[i][1];
        if (w === "y" || w.indexOf("year") === 0) {
          y+=offset;
          i++;
          return true;
        }
        if (w === "m" || w.indexOf("month") === 0) {
          m+=offset;
          i++;
          return true;
        }
        if (w === "d" || w.indexOf("day") === 0) {
          d+=offset;
          i++;
          return true;
        }
        if (w === "w" || w.indexOf("week") === 0) {
          d += 7 * offset;
          i++;
          return true;
        }
        if (w === "h" || w.indexOf("hour") === 0) {
          fillTime();
          hr+=offset;
          i++;
          return true;
        }
        if (w.indexOf("min") === 0) {
          fillTime();
          min+=offset;
          i++;
          return true;
        }
      }
      return false;
    }

    var y = null,
        m = null,
        d = null,
        hr = null,
        min = null;

    var i = 0;
    parseloop:
    while (i < parts.length) {
      if (parts[i][0] === 'ymd') {
        y = fixYear(parts[i][1]);
        m = parts[i][2];
        d = parts[i][3];
        i++;
        continue;
      }
      if (parts[i][0] === 'ym') {
        y = fixYear(parts[i][1]);
        m = parts[i][2];
        i++;
        continue;
      }
      if (parts[i][0] === 'md') {
        m = parts[i][1];
        d = parts[i][2];
        fillYear();
        i++;
        continue;
      }
      if (parts[i][0] === 'hm' || parts[i][0] === 'hms') {
        hr = parts[i][1];
        min = parts[i][2];
        i++;
        if (typ(i) === 'word') {
          if (am.test(parts[i][1])) {
            if (hr === 12) {
              hr = 0;
            }
            i++;
          } else if (pm.test(parts[i][1])) {
            if (hr < 12) {
              hr += 12;
            }
            i++;
          }
        }
        continue;
      }
      if (parts[i][0] === 'num') {
        var num = parts[i][1];

        var k = i;
        if (parseOffset(1)) {
          continue;
        }
        i = k;

        if (typ(i+1) === 'word') {
          if (/^(st|nd|rd|th)$/.test(parts[i+1][1])) {
            d = num;
            i += 2;
            continue;
          }
          if (am.test(parts[i+1][1])) {
            if (num === 12) {
              hr = 0;
            } else {
              hr = num;
            }
            i += 2;
            continue;
          }
          if (pm.test(parts[i+1][1])) {
            if (num >= 12) {
              hr = num;
            } else {
              hr = num + 12;
            }
            i += 2;
            continue;
          }
        }

        if (num > 99) {
          y = num;
          i++;
          continue;
        }
        
        d = num;
        i++;
        continue;
      }

      if (parts[i][0] === "word") {

        if (parts[i][1].indexOf("tod") === 0) {
          fillDate();
          i++;
          continue;
        }
        if (parts[i][1].indexOf("tom") === 0) {
          fillDate();
          d++;
          i++;
          continue;
        }
        if (parts[i][1].indexOf("yes") === 0) {
          fillDate();
          d--;
          i++;
          continue;
        }

        if (parts[i][1] === "now") {
          fillDate();
          fillTime();
          i++;
          continue;
        }

        for (var j = 0; j < months.length; j++) {
          if (parts[i][1].indexOf(months[j][0]) === 0) {
            m = months[j][1];
            fillYear();
            i++;
            continue parseloop;
          }
        }
        var offset = 0;
        if (typ(i+1) === "word" && i+1 < parts.length) {
          if (parts[i][1] === "next") {
            offset = 1;
            i++;
          } else if (parts[i][1] === "last") {
            offset = -1;
            i++;
          }
        }
        for (var j = 0; j < months.length; j++) {
          if (parts[i][1].indexOf(week[j]) === 0) {
            doDay(j, offset);
            i++;
            continue parseloop;
          }
        }
      }

      if (parts[i][0] === '+' || parts[i][0] === '-') {
        var offset = parts[i][0] === '+' ? 1 : -1;
        i++;
        if (parseOffset(offset)) {
          continue;
        }
      }

      // else probably not important?
      console.log("skipped", parts[i]);
      i++;
    }

    function correctTime() {
      if (hr !== null && min === null) {
        min = 0;
      }
      if (min !== null && hr === null) {
        hr = rel.getHours();
      }
      if (min !== null) {
        while (min >= 60) {
          hr++;
          min -= 60;
        }
        while (min < 0) {
          hr--;
          min += 60;
        }
      }
      if (hr !== null) {
        while (hr >= 24) {
          d++;
          hr -= 24;
        }
        while (hr < 0) {
          d--;
          hr += 24;
        }
      }
    }

    function isLeapYear (year) {
      return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }
    function daysInMonth (year, month) {
      return [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(month+11)%12];
    }

    function correctDate() {
      function correctMonth() {
        while (m > 12) {
          y++;
          m -= 12;
        }
        while (m < 1) {
          y--;
          m += 12;
        }
      }
      correctMonth();
      while (d > daysInMonth(y, m)) {
        d -= daysInMonth(y, m);
        m++;
        correctMonth();
      }
      while (d < 1) {
        if (m === 1) {
          y--;
          m = 12;
        } else {
          m--;
        }
        d += daysInMonth(y, m);
      }
    }

    fillDate();
    correctTime();
    correctDate();

    var parsed = [];
    if (y !== null) {
      parsed.push(y);
      parsed.push(m === null ? 1 : m);
      parsed.push(d === null ? 1 : d);
      if (hr !== null) {
        parsed.push(hr);
        parsed.push(min === null ? 0 : min);
      }
    }
    return parsed;
  }


  return {
    parse : parse
  };
})();

// Examples to parse
// 2011-10-10
// Wed, 09 Aug 1995 00:00:00 GMT
// 2d
// 1h
// next thursday 5pm
// tomorrow
// Jan 22
