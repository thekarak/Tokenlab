/* TokenBPE — real byte-level BPE (tiktoken-compatible) as a classic script.
   Works in browsers AND Node. Ranks load from local ./ranks/*.json (vendored,
   offline-capable). Gives bit-exact OpenAI token counts + real token IDs. */
(function (root) {
  "use strict";

  // Exact patterns from tiktoken's openai_public setup (possessive quantifiers
  // stripped — JS has no possessives; semantics identical for these patterns).
  var PATTERNS = {
    o200k_base: "[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]*[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]+(?i:'s|'t|'re|'ve|'m|'ll|'d)?|[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]+[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]*(?i:'s|'t|'re|'ve|'m|'ll|'d)?|\\p{N}{1,3}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n/]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+",
    cl100k_base: "'(?i:[sdmt]|ll|ve|re)|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}{1,3}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s+$|\\s*[\\r\\n]|\\s+(?!\\S)|\\s",
    gpt2: "'(?:[sdmt]|ll|ve|re)| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+$|\\s+(?!\\S)|\\s"
  };
  function patternFor(enc) {
    if (enc === "o200k_base") return new RegExp(PATTERNS.o200k_base, "gu");
    if (enc === "cl100k_base") return new RegExp(PATTERNS.cl100k_base, "gu");
    return new RegExp(PATTERNS.gpt2, "gu"); // p50k_base, r50k_base (GPT-2 style)
  }

  var stores = {}; // encName -> { rank: Map(binStr->id), bytes: Array(id->binStr), pat: RegExp }

  function b64ToBin(b64) {
    var bin = atob(b64), out = "";
    for (var i = 0; i < bin.length; i++) out += bin.charCodeAt(i) < 128 ? bin[i] : encodeURIComponent(bin[i]).replace(/%/g, ""); // never happens: base64 decodes to raw bytes
    return bin;
  }

  function initFromObject(encName, obj) {
    var rank = new Map(), bytes = [];
    for (var b64 in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, b64)) continue;
      var id = obj[b64], bin = atob(b64);
      rank.set(bin, id); bytes[id] = bin;
    }
    stores[encName] = { rank: rank, bytes: bytes, pat: patternFor(encName) };
    return true;
  }

  function load(encName, url) {
    if (stores[encName]) return Promise.resolve(true);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (obj) { return initFromObject(encName, obj); });
  }

  function bpeMerge(byteArr, rank) {
    var parts = new Array(byteArr.length);
    for (var i = 0; i < byteArr.length; i++) parts[i] = String.fromCharCode(byteArr[i]);
    while (parts.length > 1) {
      var best = Infinity, bi = -1;
      for (var j = 0; j < parts.length - 1; j++) {
        var r = rank.get(parts[j] + parts[j + 1]);
        if (r !== undefined && r < best) { best = r; bi = j; }
      }
      if (bi === -1) break;
      parts.splice(bi, 2, parts[bi] + parts[bi + 1]);
    }
    var ids = new Array(parts.length);
    for (var k = 0; k < parts.length; k++) ids[k] = rank.get(parts[k]);
    return { ids: ids, parts: parts };
  }

  var TE = null, TD = null;
  function te() { if (!TE) TE = new TextEncoder(); return TE; }
  function td() { if (!TD) TD = new TextDecoder("utf-8"); return TD; }
  function binToText(bin) {
    var b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return td().decode(b);
  }

  function encode(text, encName) {
    var st = stores[encName];
    if (!st) throw new Error("encoding not loaded: " + encName);
    var ids = [], pieces = [], m;
    st.pat.lastIndex = 0;
    var enc = te();
    while ((m = st.pat.exec(text)) !== null) {
      var bytes = enc.encode(m[0]);
      if (!bytes.length) { if (m[0] === "") st.pat.lastIndex++; continue; }
      var r = bpeMerge(bytes, st.rank);
      for (var i = 0; i < r.ids.length; i++) { ids.push(r.ids[i]); pieces.push(binToText(r.parts[i])); }
      if (m[0] === "") break;
    }
    return { ids: ids, pieces: pieces };
  }

  function decode(ids, encName) {
    var st = stores[encName];
    if (!st) throw new Error("encoding not loaded: " + encName);
    var bin = "";
    for (var i = 0; i < ids.length; i++) { if (st.bytes[ids[i]] !== undefined) bin += st.bytes[ids[i]]; }
    return binToText(bin);
  }

  root.TokenBPE = {
    initFromObject: initFromObject,
    load: load,
    ready: function (encName) { return !!stores[encName]; },
    encode: encode,
    decode: decode
  };
})(typeof window !== "undefined" ? window : globalThis);
