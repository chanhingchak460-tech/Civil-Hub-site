/* Civil Hub — small, dependency-free interactions */
(function () {
  "use strict";

  var root = document.body.getAttribute("data-root") || "";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- progress store ---------------- */

  var Store = {
    key: "civilhub.progress.v1",
    read: function () {
      try {
        var raw = localStorage.getItem(this.key);
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    write: function (arr) {
      try { localStorage.setItem(this.key, JSON.stringify(arr)); } catch (e) {}
      document.dispatchEvent(new CustomEvent("civilhub:progress", { detail: arr }));
    },
    has: function (slug) { return this.read().indexOf(slug) !== -1; },
    toggle: function (slug) {
      var arr = this.read();
      var i = arr.indexOf(slug);
      if (i === -1) { arr.push(slug); } else { arr.splice(i, 1); }
      this.write(arr);
      return i === -1;
    }
  };

  function totalSubjects() {
    var t = parseInt(document.body.getAttribute("data-total"), 10);
    return isNaN(t) ? 0 : t;
  }

  function refreshProgress() {
    var done = Store.read().length;
    var total = totalSubjects();
    document.querySelectorAll("[data-progress-count]").forEach(function (el) {
      el.textContent = done;
    });
    document.querySelectorAll("[data-progress-total]").forEach(function (el) {
      el.textContent = total;
    });
    document.querySelectorAll("[data-progress-bar]").forEach(function (el) {
      el.style.setProperty("--p", total ? Math.round((done / total) * 100) : 0);
    });
    document.querySelectorAll("[data-subject-card]").forEach(function (card) {
      card.classList.toggle("is-revised", Store.has(card.getAttribute("data-slug")));
    });
    document.querySelectorAll("[data-mark]").forEach(function (btn) {
      var slug = btn.getAttribute("data-mark");
      var on = Store.has(slug);
      btn.classList.toggle("is-revised", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? (btn.getAttribute("data-label-on") || "✓ Revised") : (btn.getAttribute("data-label-off") || "Mark as revised");
    });
  }

  document.addEventListener("civilhub:progress", refreshProgress);
  refreshProgress();

  /* ---------------- mark as revised ---------------- */

  document.querySelectorAll("[data-mark]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var slug = btn.getAttribute("data-mark");
      var nowOn = Store.toggle(slug);
      btn.textContent = nowOn ? (btn.getAttribute("data-label-on") || "✓ Revised") : (btn.getAttribute("data-label-off") || "Mark as revised");
    });
  });

  /* ---------------- mobile nav ---------------- */

  var menuBtn = document.querySelector("[data-menu]");
  var nav = document.querySelector(".nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------- search overlay ---------------- */

  var overlay = document.querySelector("[data-search-overlay]");
  var searchInput = overlay ? overlay.querySelector("input[type=search]") : null;
  var resultsList = overlay ? overlay.querySelector("[data-search-results]") : null;
  var emptyEl = overlay ? overlay.querySelector("[data-search-empty]") : null;
  var indexPromise = null;
  var lastFocus = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(root + "assets/search.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : { subjects: [] }; })
        .catch(function () { return { subjects: [] }; });
    }
    return indexPromise;
  }

  function openSearch() {
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    loadIndex();
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    renderResults("");
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderResults(query) {
    if (!resultsList) return;
    loadIndex().then(function (data) {
      var subjects = data.subjects || [];
      var q = query.trim().toLowerCase();
      var tokens = q ? q.split(/\s+/) : [];
      var scored = subjects.map(function (s) {
        var hay = (s.title + " " + s.subtitle + " " + s.kind + " " + s.tags.join(" ") + " " + s.summary + " " + (s.text || "")).toLowerCase();
        var score = 0;
        if (!q) score = 1;
        else {
          tokens.forEach(function (t) {
            if (s.title.toLowerCase().indexOf(t) !== -1) score += 8;
            if (s.tags.join(" ").toLowerCase().indexOf(t) !== -1) score += 3;
            if (hay.indexOf(t) !== -1) score += 1;
          });
        }
        return { s: s, score: score };
      }).filter(function (x) { return x.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 14);

      if (!scored.length) {
        resultsList.innerHTML = "";
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;
      resultsList.innerHTML = scored.map(function (x) {
        var s = x.s;
        var lang = "en";
        try { lang = localStorage.getItem("civilhub.lang") || "en"; } catch (e) {}
        var suffix = lang === "en" ? "" : "." + lang;
        return '<li class="search-result"><a href="' + root + "subjects/" + s.slug + suffix + '.html">' +
          '<span class="idx">' + String(s.order).padStart(2, "0") + "</span>" +
          '<span class="t">' + escapeHtml(s.title) +
          "<small>" + escapeHtml(s.subtitle) + "</small></span>" +
          '<span class="k">' + escapeHtml(s.kind) + "</span>" +
          "</a></li>";
      }).join("");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeSearch();
    });
    overlay.querySelectorAll("[data-close-search]").forEach(function (btn) {
      btn.addEventListener("click", closeSearch);
    });
    if (searchInput) {
      searchInput.addEventListener("input", function () { renderResults(searchInput.value); });
    }
  }

  document.querySelectorAll("[data-open-search]").forEach(function (btn) {
    btn.addEventListener("click", openSearch);
  });

  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
    if (e.key === "/" && !typing && !overlay) {
      e.preventDefault();
      openSearch();
    } else if (e.key === "/" && !typing && overlay && overlay.hidden) {
      e.preventDefault();
      openSearch();
    } else if (e.key === "Escape" && overlay && !overlay.hidden) {
      closeSearch();
    }
  });

  /* ---------------- home subject pager ---------------- */

  var homeGrid = document.querySelector("[data-subject-grid]");
  if (homeGrid) {
    var homeCards = Array.prototype.slice.call(homeGrid.querySelectorAll(".home-subject"));
    var perPage = 9;
    var page = 0;
    var pages = Math.max(1, Math.ceil(homeCards.length / perPage));
    var prevBtn = document.querySelector("[data-subject-prev]");
    var nextBtn = document.querySelector("[data-subject-next]");
    var pageEl = document.querySelector("[data-subject-page]");
    function showHomePage(p) {
      page = Math.max(0, Math.min(pages - 1, p));
      homeCards.forEach(function (c, i) {
        c.classList.toggle("is-hidden", i < page * perPage || i >= (page + 1) * perPage);
      });
      if (prevBtn) prevBtn.disabled = page === 0;
      if (nextBtn) nextBtn.disabled = page === pages - 1;
      if (pageEl) pageEl.textContent = (page + 1) + " / " + pages;
    }
    if (prevBtn) prevBtn.addEventListener("click", function () { showHomePage(page - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { showHomePage(page + 1); });
    showHomePage(0);
  }

  /* ---------------- library filters ---------------- */

  var library = document.querySelector("[data-library]");
  if (library) {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-subject-card]"));
    var state = { kind: "all", q: "" };
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-filter]"));
    var textInput = document.querySelector("[data-library-search]");
    var countEl = library.querySelector("[data-result-count]");
    var empty = library.querySelector(".library-empty");

    function applyFilters() {
      var shown = 0;
      cards.forEach(function (card) {
        var okKind = state.kind === "all" || card.getAttribute("data-kind") === state.kind;
        var hay = (card.getAttribute("data-search") || "").toLowerCase();
        var okQ = !state.q || hay.indexOf(state.q) !== -1;
        var visible = okKind && okQ;
        card.style.display = visible ? "" : "none";
        if (visible) shown++;
      });
      if (empty) empty.classList.toggle("is-visible", shown === 0);
      if (countEl) countEl.textContent = String(shown);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var group = chip.getAttribute("data-filter");
        state[group] = chip.getAttribute("data-value");
        chips.filter(function (c) { return c.getAttribute("data-filter") === group; })
          .forEach(function (c) {
            c.setAttribute("aria-pressed", c === chip ? "true" : "false");
          });
        applyFilters();
      });
    });

    if (textInput) {
      textInput.addEventListener("input", function () {
        state.q = textInput.value.trim().toLowerCase();
        applyFilters();
      });
    }

    /* initialise from URL */
    var params = new URLSearchParams(window.location.search);
    if (params.get("kind")) state.kind = params.get("kind");
    if (state.kind !== "all") {
      chips.forEach(function (c) {
        var g = c.getAttribute("data-filter");
        if (state[g] === c.getAttribute("data-value")) {
          chips.filter(function (x) { return x.getAttribute("data-filter") === g; })
            .forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        }
      });
    }
    applyFilters();
  }

  /* ---------------- quiz ---------------- */

  document.querySelectorAll("[data-quiz]").forEach(function (quiz) {
    var scoreEl = quiz.querySelector("[data-score]");
    var answered = 0;
    var right = 0;
    quiz.querySelectorAll(".quiz-q").forEach(function (q) {
      var correct = parseInt(q.getAttribute("data-correct"), 10);
      var options = Array.prototype.slice.call(q.querySelectorAll(".quiz-option"));
      var explain = q.querySelector(".quiz-explain");
      options.forEach(function (btn, idx) {
        btn.addEventListener("click", function () {
          if (q.dataset.done) return;
          q.dataset.done = "1";
          answered++;
          options.forEach(function (b, i) {
            b.disabled = true;
            if (i === correct) b.classList.add("is-correct");
            else if (i === idx) b.classList.add("is-wrong");
          });
          if (idx === correct) right++;
          if (explain) explain.classList.add("is-visible");
          if (scoreEl) {
            var zh = (document.body.getAttribute("data-content-lang") || "").indexOf("zh") === 0;
            scoreEl.textContent = right + " / " + answered + (zh ? " 正確" : " correct");
          }
        });
      });
    });
  });

  /* ---------------- TOC scrollspy ---------------- */

  var toc = document.querySelector(".toc");
  if (toc && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (id) map[id] = a;
    });
    var secs = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (a) { a.classList.remove("is-active"); });
          var a = map[entry.target.id];
          if (a) a.classList.add("is-active");
        }
      });
    }, { rootMargin: "-96px 0px -68% 0px", threshold: 0 });
    secs.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- reveal on scroll ---------------- */

  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("in"); });
    } else {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            ro.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      reveals.forEach(function (el) { ro.observe(el); });
    }
  }

  /* ---------------- formula sheet ---------------- */

  var sheet = document.querySelector("[data-formula-sheet]");
  if (sheet) {
    var printBtn = sheet.querySelector("[data-print]");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
  }

  /* ---------------- math typesetting ---------------- */

  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false,
        errorColor: "#a8432c",
        strict: false,
        trust: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"]
      });
    } catch (e) { /* leave formulas as plain text if KaTeX fails */ }
  }

  /* ---------------- footer year ---------------- */

  document.querySelectorAll("[data-year-now]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
