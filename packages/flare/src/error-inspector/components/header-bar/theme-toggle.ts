// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";

const themeToggle = (): {
    html: string;
    script: string;
} => {
    return {
        html: `
<div id="hs-theme-switch" class="flex items-center gap-1">
  <div class="hs-tooltip inline-block">
    <button type="button" aria-label="Switch to dark mode" aria-describedby="theme-tooltip-dark" class="hs-tooltip-toggle hs-dark-mode-active:hidden block hs-dark-mode font-medium rounded-full hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden focus:bg-[var(--flare-hover-overlay)] text-[var(--flare-text)]" data-hs-theme-click-value="dark">
      <span class="group inline-flex shrink-0 justify-center items-center size-8">
        <span class="dui w-5 h-5" style="-webkit-mask-image: url('${moonStarIcon}'); mask-image: url('${moonStarIcon}')"></span>
      </span>
    </button>
    <span id="theme-tooltip-dark" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-charcoal-black)] text-[var(--flare-white-smoke)]" role="tooltip">Dark</span>
  </div>

  <div class="hs-tooltip inline-block">
    <button type="button" aria-label="Switch to light mode" aria-describedby="theme-tooltip-light" class="hs-tooltip-toggle hs-dark-mode-active:block hidden hs-dark-mode font-medium rounded-full hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden focus:bg-[var(--flare-hover-overlay)] text-[var(--flare-text)]" data-hs-theme-click-value="light">
      <span class="group inline-flex shrink-0 justify-center items-center size-8">
        <span class="dui w-5 h-5" style="-webkit-mask-image: url('${sunIcon}'); mask-image: url('${sunIcon}')"></span>
      </span>
    </button>
    <span id="theme-tooltip-light" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-charcoal-black)] text-[var(--flare-white-smoke)]" role="tooltip">Light</span>
  </div>
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
