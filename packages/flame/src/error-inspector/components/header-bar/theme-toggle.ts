// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?raw";
import svgToDataUrl from "../../util/svg-to-data-url";

const themeToggle = (
    _theme?: unknown, // Not used since Preline handles theme initialization
): {
    html: string;
    script: string;
} => {
    return {
        html: `
<div id="hs-theme-switch">
  <button type="button" class="hs-dark-mode-active:hidden block hs-dark-mode font-medium rounded-full hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] text-[var(--flame-text)]" data-hs-theme-click-value="dark">
    <span class="group inline-flex shrink-0 justify-center items-center size-8">
      <span class="dui w-5 h-5" style="-webkit-mask-image: url('${svgToDataUrl(moonStarIcon)}'); mask-image: url('${svgToDataUrl(moonStarIcon)}')"></span>
    </span>
  </button>
  <button type="button" class="hs-dark-mode-active:block hidden hs-dark-mode font-medium rounded-full hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] text-[var(--flame-text)]" data-hs-theme-click-value="light">
    <span class="group inline-flex shrink-0 justify-center items-center size-8">
      <span class="dui w-5 h-5" style="-webkit-mask-image: url('${svgToDataUrl(sunIcon)}'); mask-image: url('${svgToDataUrl(sunIcon)}')"></span>
    </span>
  </button>
</div>`,
        script: `
// Minimal theme initialization for Preline compatibility
(function () {
  // Prevent transition flashes when toggling theme
  var resetEl = document.createElement('style');
  resetEl.setAttribute('data-appearance-onload-styles', '');
  resetEl.textContent = '*{transition:unset!important}';
  try { document.head.appendChild(resetEl); } catch (_) {}

  // Simple theme initialization - Preline handles the rest
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
    try { return window.localStorage.getItem('hs_theme'); } catch (_) { return null; }
  }

  function writeStoredTheme(v) {
    if (!hasLocalStorage()) return;
    try { window.localStorage.setItem('hs_theme', v); } catch (_) {}
  }

  // Basic theme application for initial load
  function applyInitialTheme() {
    var storedTheme = readStoredTheme() || 'auto';
    var resolved = storedTheme;

    if (storedTheme === 'auto') {
      var prefersDark = media && typeof media.matches === 'boolean' ? media.matches : false;
      resolved = prefersDark ? 'dark' : 'default';
    }

    if (resolved === 'dark') {
      docEl.classList.add('dark');
      docEl.classList.remove('default');
    } else {
      docEl.classList.remove('dark');
      docEl.classList.add('default');
    }

    try { resetEl.parentNode && resetEl.parentNode.removeChild(resetEl); } catch (_) {}
  }

  // Apply initial theme
  applyInitialTheme();

  // Listen for OS changes when in auto mode
  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', function () {
      if ((readStoredTheme() || 'auto') === 'auto') {
        applyInitialTheme();
      }
    });
  }
})();
`,
    };
};

export default themeToggle;
