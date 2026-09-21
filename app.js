/* Tokenlab — classic script, works on file:// and localhost */
(function () {
  var MODELS = window.MODELS || [];
  function $(id) { return document.getElementById(id); }
  var lastIds = [], idToPiece = {};
  function setStatus(m) { if ($("statusMsg")) $("statusMsg").textContent = m; }

  /* Exact engine: real tiktoken-compatible BPE (ranks vendored in ./ranks,
     lab-verified bit-identical to OpenAI on 20/20 checks). Non-OpenAI families
     map to the nearest exact base and stay honestly labeled "approx". */
  var READY = {}, LOADING = {};
  var PROFILES = {
    o200k_base:  { base: "o200k_base",  label: "o200k_base · exact" },
    cl100k_base: { base: "cl100k_base", label: "cl100k_base · exact" },
    p50k_base:   { base: "p50k_base",   label: "p50k_base · exact" },
    r50k_base:   { base: "r50k_base",   label: "r50k_base · exact" },
    claude:      { base: "cl100k_base", label: "Claude · approx (cl100k base)" },
    gemini:      { base: "cl100k_base", label: "Gemini · approx (cl100k base)" },
    llama:       { base: "cl100k_base", label: "Llama · approx (cl100k base)" },
    mistral:     { base: "cl100k_base", label: "Mistral · approx (cl100k base)" },
    deepseek:    { base: "cl100k_base", label: "DeepSeek · approx (cl100k base)" },
    qwen:        { base: "cl100k_base", label: "Qwen · approx (cl100k base)" },
    grok:        { base: "cl100k_base", label: "Grok · approx (cl100k base)" },
    mimo:        { base: "cl100k_base", label: "MiMo · approx (cl100k base)" },
    minimax:     { base: "cl100k_base", label: "MiniMax · approx (cl100k base)" },
    chars:       { mode: "chars", label: "chars ÷ 4 (rough)" },
    words:       { mode: "words", label: "words × 1.33 (rough)" }
  };

  function ensureBase(base) {
    if (!base || !window.TokenBPE) return;
    if (READY[base] || TokenBPE.ready(base)) { READY[base] = true; return; }
    if (LOADING[base]) return;
    LOADING[base] = true;
    setStatus("Loading " + base + " ranks (one-time)…");
    TokenBPE.load(base, "ranks/" + base + ".json").then(function () {
      READY[base] = true; LOADING[base] = false; refreshTokenizer();
    }, function () { LOADING[base] = false; refreshTokenizer(); });
  }

  /* fallback estimator — only while ranks load or if they are missing */
  function roughPieces(text, chunk) {
    if (!text) return [];
    var parts = text.match(/[A-Za-z0-9_~]+|[ \t]+|\n+|[^\sA-Za-z0-9_~]/g) || [];
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (/^[A-Za-z0-9_~]+$/.test(p) && p.length > 5) {
        for (var j = 0; j < p.length; j += chunk) out.push(p.slice(j, j + chunk));
      } else out.push(p);
    }
    return out;
  }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 90000; return h + 1000; }
  function tokenize(text, enc) {
    var prof = PROFILES[enc] || PROFILES.o200k_base, pieces, ids = [], i;
    idToPiece = {};
    if (prof.mode === "chars") {
      var n = Math.ceil((text || "").length / 4);
      pieces = [];
      for (i = 0; i < n; i++) pieces.push(text.slice(i * 4, i * 4 + 4));
    } else if (prof.mode === "words") {
      pieces = (text || "").trim() ? (text || "").trim().split(/\s+/) : [];
    } else if (prof.base && READY[prof.base] && (text || "").length <= 300000) {
      try {
        var r = TokenBPE.encode(text || "", prof.base);
        pieces = r.pieces; ids = r.ids;
        for (i = 0; i < pieces.length; i++) idToPiece[ids[i]] = pieces[i];
        lastIds = ids;
        return { pieces: pieces, ids: ids, label: prof.label + " ✓" };
      } catch (e) { pieces = roughPieces(text, 4); }
    } else {
      ensureBase(prof.base);
      pieces = roughPieces(text, 4);
      var base = prof.base ? " (loading exact ranks…)" : "";
      for (i = 0; i < pieces.length; i++) { var id0 = hashStr(i + ":" + pieces[i]); ids.push(id0); idToPiece[id0] = pieces[i]; }
      lastIds = ids;
      return { pieces: pieces, ids: ids, label: prof.label + base };
    }
    for (i = 0; i < pieces.length; i++) { var id = hashStr(i + ":" + pieces[i]); ids.push(id); idToPiece[id] = pieces[i]; }
    lastIds = ids;
    return { pieces: pieces, ids: ids, label: prof.label + " (estimate)" };
  }
  var CHIPS = ["var(--chip1)", "var(--chip2)", "var(--chip3)", "var(--chip4)"];

  function refreshTokenizer() {
    var text = $("inputText").value || "";
    var enc = $("encSelect").value || "o200k_base";
    var t = tokenize(text, enc), ids = t.ids, pieces = t.pieces;
    var words = (text.trim().match(/\S+/g) || []).length;
    var chars = text.length;
    var sentences = (text.match(/[.!?]+/g) || []).length;
    $("stTokens").textContent = ids.length.toLocaleString();
    $("stWords").textContent = words.toLocaleString();
    $("stChars").textContent = chars.toLocaleString();
    $("stSent").textContent = sentences.toLocaleString();
    $("stRatio").textContent = words ? (ids.length / words).toFixed(2) + " tok/w" : "-";
    $("stHeu").textContent = chars ? Math.ceil(chars / 4).toLocaleString() : "-";
    if ($("accBadge")) $("accBadge").textContent = t.label;
    var box = $("tokView"); box.innerHTML = "";
    for (var i = 0; i < pieces.length; i++) {
      var s = document.createElement("span");
      s.className = "tok"; s.textContent = pieces[i];
      s.style.background = CHIPS[i % CHIPS.length];
      s.title = "token #" + i + "  id=" + ids[i];
      box.appendChild(s);
    }
    if (!pieces.length) box.innerHTML = "<span style='color:var(--muted);font-size:12px'>Tokens will appear here…</span>";
    $("tokIds").textContent = ids.length ? (ids.length > 4000 ? ids.slice(0, 4000).join(" ") + " …(+" + (ids.length - 4000) + ")" : ids.join(" ")) : "–";
    if (document.activeElement !== $("calcIn")) $("calcIn").value = ids.length;
    if (document.activeElement !== $("cvTokens")) $("cvTokens").value = ids.length;
    if (document.activeElement !== $("cvWords")) $("cvWords").value = words;
    if (document.activeElement !== $("cvChars")) $("cvChars").value = chars;
    linkedConvert("tokens", true); updateCost();
  }

  /* linked 3-way converter */
  function linkedConvert(src, silent) {
    var t = parseFloat($("cvTokens").value || 0), w = parseFloat($("cvWords").value || 0), c = parseFloat($("cvChars").value || 0);
    if (src === "tokens") { w = Math.round(t * 0.75); c = Math.round(t * 4); $("cvWords").value = w; $("cvChars").value = c; }
    else if (src === "words") { t = Math.round(w / 0.75); c = Math.round(w * 5.2); $("cvTokens").value = t; $("cvChars").value = c; }
    else { t = Math.round(c / 4); w = Math.round(t * 0.75); $("cvTokens").value = t; $("cvWords").value = w; }
    $("cvPages").textContent = t.toLocaleString() + " tokens ⇄ " + w.toLocaleString() + " words ⇄ " + c.toLocaleString() + " chars  (" + (t / 667).toFixed(1) + " pages)";
    var st = $("respStyle").value, mult = st === "concise" ? 0.25 : st === "detailed" ? 1.5 : 0.6;
    $("cvOutEst").textContent = "Expected reply (" + st + "): ~" + Math.round(t * mult).toLocaleString() + " tokens";
    if (!silent) setStatus("Converted: " + t + " tok = " + w + " words");
  }

  /* explicit both-way boxes */
  function doW2T() {
    var w = parseFloat($("w2tIn").value || 0);
    var t = Math.round(w / 0.75), c = Math.round(w * 5.2);
    $("w2tOut").textContent = w.toLocaleString() + " words  →  " + t.toLocaleString() + " tokens  (~" + c.toLocaleString() + " chars)";
    $("cvWords").value = w; linkedConvert("words");
    setStatus("Words → Tokens done.");
  }
  function doT2W() {
    var t = parseFloat($("t2wIn").value || 0);
    var w = Math.round(t * 0.75), c = Math.round(t * 4);
    $("t2wOut").textContent = t.toLocaleString() + " tokens  →  " + w.toLocaleString() + " words  (~" + c.toLocaleString() + " chars)";
    $("cvTokens").value = t; linkedConvert("tokens");
    setStatus("Tokens → Words done.");
  }

  function fmt$(n) { return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
  function findModel(id) { for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i]; return MODELS[0]; }
  function updateCost() {
    if (!$("costModel").value) return;
    var m = findModel($("costModel").value);
    var it = parseFloat($("calcIn").value || 0), ot = parseFloat($("calcOut").value || 0), rq = Math.max(1, parseFloat($("calcReq").value || 1));
    var per = it / 1e6 * m.input + ot / 1e6 * m.output;
    $("costPerReq").textContent = fmt$(per);
    $("costMonthly").textContent = fmt$(per * rq);
    $("costYearly").textContent = fmt$(per * rq * 12);
    $("costCtx").textContent = m.name + " · " + (m.context ? (it / m.context * 100).toFixed(2) + "% of " + m.context.toLocaleString() + " context" : "");
    var all = MODELS.map(function (x) { return it / 1e6 * x.input + ot / 1e6 * x.output; });
    var mx = Math.max.apply(null, all.concat([1e-9]));
    $("costBarFill").style.width = Math.min(100, per / mx * 100) + "%";
    $("cmpList").innerHTML = MODELS.map(function (x) { return { m: x, per: it / 1e6 * x.input + ot / 1e6 * x.output }; })
      .sort(function (a, b) { return a.per - b.per; }).slice(0, 5).map(function (r, i) {
        return "<div class='row'><span>" + (i + 1) + ". <b>" + r.m.name + "</b> · " + r.m.provider + "</span><b>" + fmt$(r.per) + " /req</b></div>";
      }).join("");
  }

  function renderTable() {
    var q = ($("mSearch").value || "").toLowerCase(), pf = $("mProvider").value, tf = $("mType").value, so = $("mSort").value;
    var rows = MODELS.filter(function (m) {
      return (!q || (m.name + " " + m.provider + " " + m.best).toLowerCase().indexOf(q) >= 0) && (!pf || m.provider === pf) && (!tf || m.type === tf);
    });
    rows.sort({ price: function (a, b) { return a.input - b.input; }, outprice: function (a, b) { return a.output - b.output; }, context: function (a, b) { return b.context - a.context; }, name: function (a, b) { return a.name.localeCompare(b.name); } }[so]);
    $("mCount").textContent = "· " + rows.length + " / " + MODELS.length;
    $("mBody").innerHTML = rows.map(function (m) {
      return "<tr><td><b>" + m.name + "</b><br><span style='color:var(--muted)'>" + m.date + "</span></td><td>" + m.provider + "</td>" +
        "<td><span class='badge " + m.type + "'>" + (m.type === "open" ? "OPEN" : "CLOSED") + "</span></td><td>" + m.context.toLocaleString() +
        "</td><td>$" + m.input.toFixed(m.input < 1 ? 3 : 2) + "</td><td>$" + m.output.toFixed(m.output < 1 ? 3 : 2) + "</td><td>" + m.best +
        "</td><td><button data-use='" + m.id + "'>Use</button></td></tr>";
    }).join("");
  }

  function copyText(txt, msg) {
    function ok() { setStatus(msg || "Copied."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { fb(); ok(); });
    else { fb(); ok(); }
    function fb() { var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); }
  }
  function decodeIds() {
    var raw = ($("decodeInput").value || "").trim();
    if (!raw) { setStatus("Paste token IDs first."); return; }
    var ids = raw.split(/[\s,]+/).map(Number).filter(isFinite), i;
    var enc = $("encSelect").value || "o200k_base";
    var prof = PROFILES[enc] || {};
    var el = $("decodeOut"); el.classList.remove("hidden");
    if (prof.base && READY[prof.base]) {
      try {
        el.textContent = "Decoded: " + TokenBPE.decode(ids, prof.base);
        setStatus("Decoded " + ids.length + " ids (exact).");
        return;
      } catch (e) {}
    }
    var out = [], miss = 0;
    for (i = 0; i < ids.length; i++) { if (idToPiece[ids[i]] !== undefined) out.push(idToPiece[ids[i]]); else miss++; }
    el.textContent = "Decoded: " + out.join("") + (miss ? "  [+" + miss + " ids from other text]" : "");
    setStatus("Decoded " + ids.length + " ids.");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var sorted = MODELS.slice().sort(function (a, b) { return a.input - b.input; });
    $("costModel").innerHTML = sorted.map(function (m) { return "<option value='" + m.id + "'>" + m.name + " — $" + m.input + " / $" + m.output + " per 1M</option>"; }).join("");
    $("costModel").value = "gpt-5.6-terra";
    var pv = []; MODELS.forEach(function (m) { if (pv.indexOf(m.provider) < 0) pv.push(m.provider); }); pv.sort();
    $("mProvider").innerHTML = "<option value=''>All providers</option>" + pv.map(function (p) { return "<option>" + p + "</option>"; }).join("");

    var deb; $("inputText").addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(refreshTokenizer, 120); });
    $("encSelect").addEventListener("change", function () { var p = PROFILES[$("encSelect").value] || {}; ensureBase(p.base); refreshTokenizer(); });
    $("btnSample").addEventListener("click", function () { $("inputText").value = "Tokens are the building blocks of language models. One token is about 4 characters, or roughly 0.75 English words.\n\nPaste your own prompt here to count it, convert it, and price it on " + MODELS.length + " models."; refreshTokenizer(); });
    $("btnClear").addEventListener("click", function () { $("inputText").value = ""; refreshTokenizer(); });
    $("btnCopyText").addEventListener("click", function () { copyText($("inputText").value, "Text copied."); });
    $("btnCopy").addEventListener("click", function () { copyText($("tokIds").textContent, "Token IDs copied."); });
    $("btnUpload").addEventListener("click", function () { $("fileInput").click(); });
    $("fileInput").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function () { $("inputText").value = String(r.result).slice(0, 500000); refreshTokenizer(); }; r.readAsText(f);
    });
    $("btnDecode").addEventListener("click", decodeIds);

    $("cvTokens").addEventListener("input", function () { linkedConvert("tokens"); });
    $("cvWords").addEventListener("input", function () { linkedConvert("words"); });
    $("cvChars").addEventListener("input", function () { linkedConvert("chars"); });
    $("respStyle").addEventListener("change", function () { linkedConvert("tokens"); });
    $("btnW2T").addEventListener("click", doW2T);
    $("btnT2W").addEventListener("click", doT2W);
    $("w2tIn").addEventListener("keydown", function (e) { if (e.key === "Enter") doW2T(); });
    $("t2wIn").addEventListener("keydown", function (e) { if (e.key === "Enter") doT2W(); });
    $("btnUseTok").addEventListener("click", function () { $("calcOut").value = $("cvTokens").value; updateCost(); document.getElementById("costCtx").scrollIntoView({ behavior: "smooth", block: "center" }); });
    $("preset500").addEventListener("click", function () { $("cvWords").value = 500; linkedConvert("words"); });
    $("preset2000").addEventListener("click", function () { $("cvWords").value = 2000; linkedConvert("words"); });
    $("preset80k").addEventListener("click", function () { $("cvWords").value = 80000; linkedConvert("words"); });
    $("preset128k").addEventListener("click", function () { $("cvTokens").value = 128000; linkedConvert("tokens"); });

    $("costModel").addEventListener("change", updateCost);
    $("calcIn").addEventListener("input", updateCost);
    $("calcOut").addEventListener("input", updateCost);
    $("calcReq").addEventListener("input", updateCost);
    $("btnSync").addEventListener("click", function () { $("calcIn").value = lastIds.length; updateCost(); setStatus("Synced from text."); });
    $("btnResetCost").addEventListener("click", function () { $("calcIn").value = 0; $("calcOut").value = 500; $("calcReq").value = 1000; updateCost(); });

    $("mSearch").addEventListener("input", renderTable);
    $("mProvider").addEventListener("change", renderTable);
    $("mType").addEventListener("change", renderTable);
    $("mSort").addEventListener("change", renderTable);
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-use]") : null;
      if (b) { $("costModel").value = b.getAttribute("data-use"); updateCost(); window.scrollTo({ top: 0, behavior: "smooth" }); setStatus("Model loaded into calculator."); }
    });

    // Live digital clock & date in dashboard header
    function initLiveClock() {
      var timeEl = $("clockTime");
      var dateEl = $("clockDate");
      var clockEl = $("liveClock");
      if (!timeEl && !dateEl) return;

      var is24Hour = false;
      function pad(n) { return n < 10 ? "0" + n : n; }

      function update() {
        var now = new Date();
        var hours = now.getHours();
        var minutes = now.getMinutes();
        var seconds = now.getSeconds();

        var timeStr = "";
        if (is24Hour) {
          timeStr = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
        } else {
          var ampm = hours >= 12 ? "PM" : "AM";
          var h12 = hours % 12;
          if (h12 === 0) h12 = 12;
          timeStr = pad(h12) + ":" + pad(minutes) + ":" + pad(seconds) + " " + ampm;
        }

        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var dateStr = days[now.getDay()] + ", " + pad(now.getDate()) + " " + months[now.getMonth()] + " " + now.getFullYear();

        if (timeEl) timeEl.textContent = timeStr;
        if (dateEl) dateEl.textContent = dateStr;
      }

      if (clockEl) {
        clockEl.addEventListener("click", function () {
          is24Hour = !is24Hour;
          update();
        });
      }

      update();
      setInterval(update, 1000);
    }

    initLiveClock();
    ensureBase("o200k_base");
    renderTable(); linkedConvert("tokens", true); refreshTokenizer(); doW2T(); doT2W(); updateCost();
    setStatus("Ready. " + MODELS.length + " models loaded.");
    if (!localStorage.getItem("tokenlab_seen")) $("welcomeOverlay").classList.remove("hidden");
    if ($("btnGuide")) $("btnGuide").addEventListener("click", function () { $("welcomeOverlay").classList.remove("hidden"); });
    function closeWelcome(persist) {
      $("welcomeOverlay").classList.add("hidden");
      if (persist || ($("chkWelcomeHide") && $("chkWelcomeHide").checked)) { try { localStorage.setItem("tokenlab_seen", "1"); } catch (e) {} }
    }
    $("btnWelcomeStart").addEventListener("click", function () {
      closeWelcome(true);
      $("inputText").value = "Tokens are the building blocks of language models. One token is about 4 characters, or roughly 0.75 English words.\n\nTry me: 1) see exact tokens on the left, 2) convert words to tokens below, 3) price this text on every model.";
      refreshTokenizer();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("btnWelcomeSkip").addEventListener("click", function () { closeWelcome(false); });
  });
})();
