// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";

const themeToggle = (): {
    html: string;
    script: string;
} => {
    const baseCss = "flex justify-center items-center size-9 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)] text-[var(--ono-text)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:bg-[var(--ono-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

    return {
        html: `
<div id="ono-theme-switch" class="flex items-center">
  <div class="inline-block">
    <button type="button" aria-label="Switch to dark mode" title="Dark mode" class="ono-theme-btn ono-theme-dark hidden ${baseCss}" data-ono-theme="dark">
      <span class="inline-flex shrink-0 justify-center items-center size-4">
        <span class="dui" style="-webkit-mask-image: url('${moonStarIcon}'); mask-image: url('${moonStarIcon}')"></span>
      </span>
    </button>
  </div>

  <div class="inline-block">
    <button type="button" aria-label="Switch to light mode" title="Light mode" class="ono-theme-btn ono-theme-light ${baseCss}" data-ono-theme="light">
      <span class="inline-flex shrink-0 justify-center items-center size-4">
        <span class="dui" style="-webkit-mask-image: url('${sunIcon}'); mask-image: url('${sunIcon}')"></span>
      </span>
    </button>
  </div>
</div>`,
        script: `
// ono theme toggle initialization
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  function $$(selector, context) {
    return Array.from((context || document).querySelectorAll(selector));
  }

  function hasClass(el, className) {
    return el.classList.contains(className);
  }

  function addClass(el, className) {
    el.classList.add(className);
  }

  function removeClass(el, className) {
    el.classList.remove(className);
  }

  function showDarkButton() {
    const darkBtn = $('.ono-theme-dark');
    const lightBtn = $('.ono-theme-light');
    if (darkBtn && lightBtn) {
      removeClass(darkBtn, 'hidden');
      addClass(lightBtn, 'hidden');
    }
  }

  function showLightButton() {
    const darkBtn = $('.ono-theme-dark');
    const lightBtn = $('.ono-theme-light');
    if (darkBtn && lightBtn) {
      addClass(darkBtn, 'hidden');
      removeClass(lightBtn, 'hidden');
    }
  }

  ready(function() {
    // Show appropriate button based on current theme
    if (document.documentElement.classList.contains('dark')) {
      showLightButton();
    } else {
      showDarkButton();
    }

    // Listen for theme changes
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (document.documentElement.classList.contains('dark')) {
            showLightButton();
          } else {
            showDarkButton();
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  });
})();
`,
    };
};

export default themeToggle;
