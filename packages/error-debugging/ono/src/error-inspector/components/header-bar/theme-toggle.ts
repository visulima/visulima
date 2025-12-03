// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";

import type { Theme } from "../../../types";

const themeToggle = (
    theme: Theme = "auto",
): {
    html: string;
    script: string;
} => {
    const baseCss
        = "flex justify-center items-center size-9 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)] text-[var(--ono-text)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:bg-[var(--ono-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

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
  // Theme switching functions
function setTheme(theme) {
    if (theme === 'dark') {
        addClass(document.documentElement, 'dark');
        removeClass(document.documentElement, 'light');
    } else {
        removeClass(document.documentElement, 'dark');
        addClass(document.documentElement, 'light');
    }

    localStorage.setItem('ono:theme', theme);
}

function getStoredTheme() {
    return localStorage.getItem('ono:theme') || '${theme}';
}

function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
    const stored = getStoredTheme();
    const theme = stored === 'auto' ? getSystemTheme() : stored;
    setTheme(theme);
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

  // Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
    if (getStoredTheme() === 'auto') {
        applyTheme();
    }
});

  // Handle theme toggle buttons
document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-ono-theme]');
    if (btn) {
        const theme = btn.getAttribute('data-ono-theme');
        setTheme(theme);
    }
});

ready(function() {
    applyTheme();

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
});`,
    };
};

export default themeToggle;
