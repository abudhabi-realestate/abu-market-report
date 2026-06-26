/** Minimal i18n — copy into each static site or load as script before app code */
window.SiteI18n = (function () {
  const STORAGE_KEY = 'site-lang';
  let lang = localStorage.getItem(STORAGE_KEY) || 'zh';
  const dict = { zh: {}, en: {} };

  function t(key, vars, fallback) {
    let v = dict[lang]?.[key] ?? dict.zh[key];
    if (v == null) v = fallback != null ? fallback : key;
    if (vars && typeof v === 'string') {
      Object.entries(vars).forEach(([k, val]) => {
        v = v.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val));
      });
    }
    return v;
  }

  function getLang() { return lang; }

  function setLang(next) {
    if (next !== 'zh' && next !== 'en') return;
    lang = next;
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    apply();
    window.dispatchEvent(new CustomEvent('site-lang-change', { detail: { lang: next } }));
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
      btn.setAttribute('aria-pressed', btn.dataset.lang === lang ? 'true' : 'false');
    });
    const titleKey = document.body?.dataset?.i18nTitle;
    if (titleKey) document.title = t(titleKey);
  }

  function bindSwitch() {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
  }

  function init(translations) {
    if (translations?.zh) Object.assign(dict.zh, translations.zh);
    if (translations?.en) Object.assign(dict.en, translations.en);
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    bindSwitch();
    apply();
  }

  return { t, getLang, setLang, apply, init };
})();
