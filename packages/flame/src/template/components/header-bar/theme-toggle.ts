// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?raw";

import type { Theme } from "../../../types";

const themeToggle = (
    theme?: Theme,
): {
    html: string;
    script: string;
} => {
    return {
        html: `
<button id="theme-toggle-button" type="button" class="cursor-pointer group flex items-center text-gray-600 hover:text-blue-600 font-medium dark:text-gray-300 dark:hover:text-gray-200" aria-label="Toggle theme">
    <span id="theme-toggle-icon" class="dui"></span>
</button>
`,
        script: `
// initial theme provided by server/template (can be undefined)
const initialTheme = ${JSON.stringify(theme ?? undefined)};

(function () {
  // Prevent transition flashes when toggling theme
  var resetEl = document.createElement('style');
  resetEl.setAttribute('data-appearance-onload-styles', '');
  resetEl.textContent = '*{transition:unset!important}';
  try { document.head.appendChild(resetEl); } catch (_) {}

  var docEl = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function hasLocalStorage() {
    try {
      var k = '__theme_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (_) { return false; }
  }

  function readStoredTheme() {
    if (!hasLocalStorage()) return null;
    try { return window.localStorage.getItem('theme'); } catch (_) { return null; }
  }

  function writeStoredTheme(v) {
    if (!hasLocalStorage()) return;
    try { window.localStorage.setItem('theme', v); } catch (_) {}
  }

  function normalize(mode) {
    if (mode === 'light') return 'default';
    if (mode === 'dark' || mode === 'default' || mode === 'auto') return mode;
    return 'auto';
  }

  function resolve(mode) {
    var m = normalize(mode);
    if (m === 'auto') {
      var prefersDark = media && typeof media.matches === 'boolean' ? media.matches : false;
      return prefersDark ? 'dark' : 'default';
    }
    return m;
  }

  function apply(mode, dispatch) {
    var resolved = resolve(mode);
    // Toggle classes
    if (resolved === 'dark') {
      docEl.classList.add('dark');
      docEl.classList.remove('default');
    } else {
      docEl.classList.remove('dark');
      docEl.classList.add('default');
    }
    if (dispatch !== false) {
      try { window.dispatchEvent(new CustomEvent('on-appearance-change', { detail: resolved })); } catch (_) {}
    }
    return resolved;
  }

  // Public API
  window.ThemeAppearance = {
    get: function () { return readStoredTheme() || 'auto'; },
    set: function (mode) { var m = normalize(mode); writeStoredTheme(m); apply(m, true); }
  };

  // Initialize
  var start = normalize(initialTheme || readStoredTheme());
  apply(start, false);
  try { resetEl.parentNode && resetEl.parentNode.removeChild(resetEl); } catch (_) {}

  // React to OS changes when in auto
  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', function () {
      if ((readStoredTheme() || 'auto') === 'auto') apply('auto', true);
    });
  }

  // Wire UI controls
  (window.subscribeToDOMContentLoaded || function (fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  })(function () {
    var toggleBtn = document.getElementById('theme-toggle-button');
    var toggleIcon = document.getElementById('theme-toggle-icon');

    function setToggleIcon() {
      var current = resolve(window.ThemeAppearance.get());
      // show icon for the action you'll take on click
      var iconUrl = current === 'dark' ? '${sunIcon}' : '${moonStarIcon}';
      toggleIcon.style.webkitMaskImage = 'url(' + iconUrl + ')';
      toggleIcon.style.maskImage = 'url(' + iconUrl + ')';
    }

    setToggleIcon();

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var current = resolve(window.ThemeAppearance.get());
        var next = current === 'dark' ? 'default' : 'dark';
        window.ThemeAppearance.set(next);
        setToggleIcon();
      });
    }
    var switches = document.querySelectorAll('[data-theme-switch]');
    for (var j = 0; j < switches.length; j++) {
      (function (el) {
        el.addEventListener('change', function (e) {
          window.ThemeAppearance.set(e.target.checked ? 'dark' : 'default');
          setToggleIcon();
        });
        el.checked = resolve(window.ThemeAppearance.get()) === 'dark';
      })(switches[j]);
    }

    window.addEventListener('on-appearance-change', function () {
      setToggleIcon();
    });
  });
})();
`,
    };
};

export default themeToggle;
