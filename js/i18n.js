/* Civil Hub — interface language switcher */
(function () {
  "use strict";
  var root = document.body.getAttribute("data-root") || "";
  var dict = null;

  function val(lang, key) {
    return dict && dict[lang] && dict[lang][key] ? dict[lang][key] : null;
  }

  var catI18n = null;
  var currentLang = "en";
  function suffix(lang) { return lang === "en" ? "" : "." + lang; }

  function localizeCards(lang) {
    if (!catI18n) return;
    document.querySelectorAll("[data-subject-card]").forEach(function (card) {
      var slug = card.getAttribute("data-slug");
      var t = catI18n[lang] && catI18n[lang][slug];
      if (!t) return;
      var ti = card.querySelector(".subject-card-title");
      var su = card.querySelector(".subject-card-sub");
      if (ti && t.title) ti.textContent = t.title;
      if (su && t.subtitle) su.textContent = t.subtitle;
      if (card.getAttribute("href") && card.getAttribute("href").indexOf("subjects/") === 0) {
        card.setAttribute("href", "subjects/" + slug + suffix(lang) + ".html");
      }
    });
  }

  function apply(lang) {
    if (!dict) return;
    if (!dict[lang]) lang = "en";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = val(lang, el.getAttribute("data-i18n"));
      if (v !== null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = val(lang, el.getAttribute("data-i18n-html"));
      if (v !== null) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var v = val(lang, el.getAttribute("data-i18n-placeholder"));
      if (v !== null) el.setAttribute("placeholder", v);
    });
    document.querySelectorAll("[data-lang-switch]").forEach(function (sel) { sel.value = lang; });
    var notice = document.querySelector("[data-lang-notice]");
    if (notice) {
      var contentLang = document.body.getAttribute("data-content-lang") || "en";
      var text = (lang !== "en" && contentLang === "en") ? val(lang, "subject.notice") : null;
      if (text) { notice.textContent = text; notice.hidden = false; }
      else { notice.hidden = true; notice.textContent = ""; }
    }
    currentLang = lang;
    localizeCards(lang);
    try { localStorage.setItem("civilhub.lang", lang); } catch (e) {}
  }

  function load() {
    fetch(root + "assets/i18n.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        dict = d;
        var stored = null;
        var pageLang = document.body.getAttribute("data-page-lang");
        try { stored = localStorage.getItem("civilhub.lang"); } catch (e) {}
        var saved = (pageLang && pageLang !== "en") ? pageLang : (stored || pageLang || "en");
        if (!saved) {
          var cl = document.body.getAttribute("data-content-lang") || "en";
          saved = cl.indexOf("zh") === 0 ? "zh-Hant" : "en";
        }
        var altLang = saved ? saved.toLowerCase() : "";
        var alt = altLang ? document.body.getAttribute("data-alt-" + altLang) : null;
        var pageLangAttr = document.body.getAttribute("data-page-lang");
        if (pageLangAttr === "en" && alt && saved !== "en") {
          window.location.replace(alt);
          return;
        }
        apply(saved);
      })
      .catch(function () {});
  }

  document.querySelectorAll("[data-lang-switch]").forEach(function (sel) {
    sel.addEventListener("change", function () {
      var lang = sel.value;
      var alt = document.body.getAttribute("data-alt-" + lang.toLowerCase());
      var current = document.body.getAttribute("data-page-lang");
      if (alt && current && current !== lang) {
        try { localStorage.setItem("civilhub.lang", lang); } catch (e) {}
        window.location.href = alt;
        return;
      }
      apply(lang);
    });
  });
  fetch(root + "assets/catalogue-i18n.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { catI18n = d; if (currentLang !== "en" && dict) apply(currentLang); })
    .catch(function () {});
  load();
})();
