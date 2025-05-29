import moonStarIcon from "lucide-static/icons/moon-star.svg";
import sunIcon from "lucide-static/icons/sun.svg";

import type { Theme } from "../../../types";

const themeToggle = (
    theme?: Theme,
): {
    html: string;
    script: string;
} => {
    return {
        html: `
<div class="flex ml-6">
    <button type="button" class="hs-dark-mode-active:hidden hs-dark-mode group flex items-center text-gray-600 hover:text-blue-600 font-medium dark:text-gray-400 dark:hover:text-gray-500" data-hs-theme-click-value="dark">
        <img src="${moonStarIcon}" alt="Moon Star" class="w-4 h-4" />
    </button>
    <button type="button" class="hs-dark-mode-active:flex hidden hs-dark-mode group items-center text-gray-600 hover:text-blue-600 font-medium dark:text-gray-400 dark:hover:text-gray-500" data-hs-theme-click-value="light">
        <img src="${sunIcon}" alt="Sun" class="w-4 h-4" />
    </button>
</div>
`,
        script: `
const HSThemeAppearance = {
    init() {
        const defaultTheme = 'default';
        let theme = ${theme} || localStorage.getItem('hs_theme') || defaultTheme;

        if (document.querySelector('html').classList.contains('dark')) {
            return;
        }
        this.setAppearance(theme);
    },
    _resetStylesOnLoad() {
        const $resetStyles = document.createElement('style');

        $resetStyles.innerText = \`*{transition: unset !important;}\`;
        $resetStyles.setAttribute('data-hs-appearance-onload-styles', '');

        document.head.appendChild($resetStyles);

        return $resetStyles;
    },
    setAppearance(theme, saveInStore = true, dispatchEvent = true) {
        const $resetStylesEl = this._resetStylesOnLoad()

        if (saveInStore) {
            localStorage.setItem('hs_theme', theme)
        }

        if (theme === 'auto') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
        }

        document.querySelector('html').classList.remove('dark')
        document.querySelector('html').classList.remove('default')
        document.querySelector('html').classList.remove('auto')

        document.querySelector('html').classList.add(this.getOriginalAppearance())

        setTimeout(() => {
            $resetStylesEl.remove()
        })

        if (dispatchEvent) {
            window.dispatchEvent(new CustomEvent('on-hs-appearance-change', {detail: theme}))
        }
    },
    getAppearance() {
        let theme = this.getOriginalAppearance()
        if (theme === 'auto') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
        }
        return theme
    },
    getOriginalAppearance() {
        const defaultTheme = 'default'
        return localStorage.getItem('hs_theme') || defaultTheme
    }
}
HSThemeAppearance.init()

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (HSThemeAppearance.getOriginalAppearance() === 'auto') {
        HSThemeAppearance.setAppearance('auto', false)
    }
})

window.addEventListener('load', () => {
    const $clickableThemes = document.querySelectorAll('[data-hs-theme-click-value]')
    const $switchableThemes = document.querySelectorAll('[data-hs-theme-switch]')

    $clickableThemes.forEach($item => {
        $item.addEventListener('click', () => HSThemeAppearance.setAppearance($item.getAttribute('data-hs-theme-click-value'), true, $item))
    })

    $switchableThemes.forEach($item => {
        $item.addEventListener('change', (e) => {
            HSThemeAppearance.setAppearance(e.target.checked ? 'dark' : 'default')
        })

        $item.checked = HSThemeAppearance.getAppearance() === 'dark'
    })

    window.addEventListener('on-hs-appearance-change', e => {
        $switchableThemes.forEach($item => {
            $item.checked = e.detail === 'dark'
        })
    })
});
`,
    };
};

export default themeToggle;
