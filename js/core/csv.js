/* RFC 4180 CSV reader and writer. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.csv = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.csv;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // -> array of rows (arrays of strings). Handles BOM, quotes, "" escapes,
  // commas and newlines inside quotes, \r\n, and a trailing empty line.
  function parse(text) {
    text = String(text == null ? '' : text);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [], row = [], field = '', i = 0, n = text.length, inQ = false, fieldStarted = false;
    while (i < n) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && !fieldStarted) { inQ = true; fieldStarted = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; fieldStarted = false; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); rows.push(row); row = []; field = ''; fieldStarted = false;
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        i++; continue;
      }
      field += c; fieldStarted = true; i++;
    }
    if (fieldStarted || field !== '' || row.length) { row.push(field); rows.push(row); }
    // drop blank lines
    return rows.filter(function (r) { return !(r.length === 1 && r[0].trim() === ''); });
  }

  // -> {headers:[lowercase], rows:[{header:value, _row: lineNumber}]}
  function toObjects(text) {
    var rows = parse(text);
    if (!rows.length) return { headers: [], rows: [] };
    var headers = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var o = { _row: r + 1 };
      for (var c = 0; c < headers.length; c++) {
        if (headers[c] && !(headers[c] in o && o[headers[c]] !== '')) o[headers[c]] = rows[r][c] == null ? '' : rows[r][c];
      }
      out.push(o);
    }
    return { headers: headers, rows: out };
  }

  function cell(v) {
    var s = v == null ? '' : String(v);
    return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function stringify(rows) {
    return rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
  }

  return { parse: parse, toObjects: toObjects, stringify: stringify };
});
