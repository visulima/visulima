import type { VisulimaError } from "@visulima/error/error";
import type { SolutionError, SolutionFinder } from "@visulima/error/solution";

import headerBar from "./components/header-bar";
import type { HeaderTab } from "./components/header-tabs";
import { headerTabs } from "./components/header-tabs";
import inlineCss from "./index.css";
import layout from "./layout";
import createStackPage from "./page/stack";
import type { TemplateOptions } from "./types";
import { sanitizeHtml } from "./util/sanitize";

// Custom UI components initialization - replaces Preline
const onoUIInit = `
(function() {
  'use strict';

  // Utility functions
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

  function toggleClass(el, className) {
    el.classList.toggle(className);
  }


  // Theme switching
  function initThemeToggle() {
    const html = document.documentElement;

    function setTheme(theme) {
      if (theme === 'dark') {
        addClass(html, 'dark');
        removeClass(html, 'light');
      } else {
        removeClass(html, 'dark');
        addClass(html, 'light');
      }
      localStorage.setItem('ono:theme', theme);
    }

    function getStoredTheme() {
      return localStorage.getItem('ono:theme') || 'auto';
    }

    function getSystemTheme() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme() {
      const stored = getStoredTheme();
      const theme = stored === 'auto' ? getSystemTheme() : stored;
      setTheme(theme);
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

    applyTheme();
  }

  // Tabs system
  function initTabs() {
    function activateTab(tabTrigger) {
      const targetId = tabTrigger.getAttribute('data-ono-tab') || tabTrigger.getAttribute('data-stack-tab');
      if (!targetId) return;

      const container = tabTrigger.closest('[role="tablist"]')?.parentElement;
      if (!container) return;

      // Find all tabs and panels globally (not just within container)
      const allTabs = $$('[role="tab"]');
      const allPanels = $$('[role="tabpanel"]');

      allTabs.forEach(tab => {
        tab.setAttribute('aria-selected', 'false');
        removeClass(tab, 'active');
        removeClass(tab, 'ono-tab-active');
      });

      allPanels.forEach(panel => {
        addClass(panel, 'hidden');
        removeClass(panel, 'block');
      });

      // Activate target tab and panel
      tabTrigger.setAttribute('aria-selected', 'true');
      addClass(tabTrigger, 'active');
      addClass(tabTrigger, 'ono-tab-active');

      // Find target panel globally (not within container)
      const targetPanel = $(targetId);
      if (targetPanel) {
        removeClass(targetPanel, 'hidden');
        addClass(targetPanel, 'block');
      }
    }

    document.addEventListener('click', function(e) {
      const tab = e.target.closest('[role="tab"], [data-ono-tab]');
      if (tab && !tab.hasAttribute('disabled')) {
        e.preventDefault();
        activateTab(tab);
      }
    });

    document.addEventListener('keydown', function(e) {
      const tab = e.target.closest('[role="tab"]');
      if (!tab) return;

      const container = tab.closest('[role="tablist"]');
      if (!container) return;

      // Find all tabs in the same tablist (not globally)
      const tabs = $$('[role="tab"]:not([disabled])', container);
      const currentIndex = tabs.indexOf(tab);

      let nextIndex = -1;

      if (e.key === 'ArrowLeft') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      } else if (e.key === 'ArrowRight') {
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex >= 0) {
        e.preventDefault();
        tabs[nextIndex].focus();
        activateTab(tabs[nextIndex]);
      }
    });

    // Initialize the active tab on page load
    const activeTab = $('[role="tab"][aria-selected="true"]');
    if (activeTab) {
      activateTab(activeTab);
    }
  }

  // Clipboard functionality
  function initClipboard() {
    function copyToClipboard(text, successCallback) {
      if (!text) return;

      navigator.clipboard.writeText(text).then(function() {
        if (successCallback) successCallback();
      }).catch(function(err) {
        console.warn('Failed to copy:', err);
      });
    }

    function showCopySuccess(button) {
      const defaultIcon = $('.ono-copy-default', button);
      const successIcon = $('.ono-copy-success', button);

      if (defaultIcon && successIcon) {
        addClass(defaultIcon, 'hidden');
        removeClass(successIcon, 'hidden');
        setTimeout(() => {
          removeClass(defaultIcon, 'hidden');
          addClass(successIcon, 'hidden');
        }, 2000);
      }
    }

    // Handle copy buttons
    document.addEventListener('click', function(e) {
      const copyBtn = e.target.closest('.ono-copy-btn');
      if (copyBtn) {
        e.preventDefault();
        const targetId = copyBtn.getAttribute('data-target');
        const target = targetId ? $(targetId) : null;
        const text = target ? (target.value || target.textContent || '') : '';

        if (text) {
          copyToClipboard(text, () => showCopySuccess(copyBtn));
        }
      }

      // Handle dropdown copy menu items
      const menuItem = e.target.closest('.ono-copy-menu-item');
      if (menuItem) {
        e.preventDefault();
        const targetId = menuItem.getAttribute('data-target');
        const textAttr = menuItem.getAttribute('data-text');
        const successText = menuItem.getAttribute('data-success-text');

        let text = '';
        if (textAttr) {
          text = textAttr;
        } else if (targetId) {
          const target = $(targetId);
          text = target ? (target.value || target.textContent || '') : '';
        }

        if (text) {
          copyToClipboard(text, () => {
            // Show success on dropdown toggle
            const dropdown = menuItem.closest('.ono-dropdown');
            if (dropdown) {
              showCopySuccess($('.ono-dropdown-toggle', dropdown));
              // Close dropdown after copy
              const menu = $('.ono-dropdown-menu', dropdown);
              const trigger = $('.ono-dropdown-toggle', dropdown);
              if (menu && trigger) {
                removeClass(menu, 'ono-dropdown-open');
                removeClass(trigger, 'ono-dropdown-open');
              }
            }
          });
        }
      }
    });
  }

  // Dropdown system
  function initDropdowns() {
    let activeDropdown = null;

    function toggleDropdown(trigger) {
      const dropdown = trigger.closest('.ono-dropdown');
      if (!dropdown) return;

      const menu = $('.ono-dropdown-menu', dropdown);
      if (!menu) return;

      const isOpen = !hasClass(menu, 'ono-dropdown-open');

      // Close any open dropdown
      if (activeDropdown && activeDropdown !== dropdown) {
        closeDropdown(activeDropdown);
      }

      if (isOpen) {
        openDropdown(dropdown);
      } else {
        closeDropdown(dropdown);
      }
    }

    function openDropdown(dropdown) {
      const menu = $('.ono-dropdown-menu', dropdown);
      const trigger = $('.ono-dropdown-toggle', dropdown);

      addClass(menu, 'ono-dropdown-open');
      addClass(trigger, 'ono-dropdown-open');
      activeDropdown = dropdown;
    }

    function closeDropdown(dropdown) {
      const menu = $('.ono-dropdown-menu', dropdown);
      const trigger = $('.ono-dropdown-toggle', dropdown);

      removeClass(menu, 'ono-dropdown-open');
      removeClass(trigger, 'ono-dropdown-open');

      if (activeDropdown === dropdown) {
        activeDropdown = null;
      }
    }

    function closeAllDropdowns() {
      if (activeDropdown) {
        closeDropdown(activeDropdown);
      }
    }

    document.addEventListener('click', function(e) {
      const trigger = e.target.closest('.ono-dropdown-toggle');
      if (trigger) {
        e.preventDefault();
        toggleDropdown(trigger);
        return;
      }

      // Close dropdown if clicked outside
      if (activeDropdown && !e.target.closest('.ono-dropdown')) {
        closeDropdown(activeDropdown);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && activeDropdown) {
        closeDropdown(activeDropdown);
      }
    });
  }

  // Make modal functions globally available immediately
  let originalBodyOverflow = '';

  window.showShortcutsModal = function() {
    const modal = document.getElementById('ono-shortcuts-modal');
    if (modal) {
      // Prevent body scrolling
      if (!originalBodyOverflow) {
        originalBodyOverflow = document.body.style.overflow || '';
      }
      document.body.style.overflow = 'hidden';

      removeClass(modal, 'hidden');
      modal.focus();
    }
  };

  window.hideShortcutsModal = function() {
    const modal = document.getElementById('ono-shortcuts-modal');
    if (modal) {
      addClass(modal, 'hidden');

      // Restore body scrolling
      document.body.style.overflow = originalBodyOverflow;
      originalBodyOverflow = '';
    }
  };

  // Shortcuts modal functionality
  function initShortcutsModal() {
    // Create modal HTML
    const modalHTML = \`
    <div id="ono-shortcuts-modal" class="fixed inset-0 z-50 hidden backdrop-blur-xl flex items-center justify-center p-4">
      <div class="bg-[var(--ono-surface)] rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-2)] max-w-md w-full max-h-[90vh] overflow-auto">
        <div class="flex items-center justify-between p-4 border-b border-[var(--ono-border)]">
          <div class="flex items-center gap-2">
            <span class="text-[var(--ono-text)] text-lg font-bold">⌨</span>
            <h3 class="font-semibold text-[var(--ono-text)] text-lg">Keyboard shortcuts</h3>
          </div>
          <button onclick="hideShortcutsModal()" class="text-[var(--ono-text-muted)] hover:text-[var(--ono-text)] p-1 text-xl font-bold">
            ×
          </button>
        </div>

        <div class="p-4">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-[var(--ono-text)]">Press</span>
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">?</kbd>
            <span class="text-sm text-[var(--ono-text)]">to open this help</span>
          </div>

          <ul class="grid grid-cols-1 gap-3">
            <li class="flex items-start justify-between gap-3">
              <span class="text-sm text-[var(--ono-text)]">Move focus</span>
              <div class="flex items-center gap-1 shrink-0">
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Tab</kbd>
                <span class="text-[11px] text-[var(--ono-text-muted)]">or</span>
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Shift</kbd>
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Tab</kbd>
              </div>
            </li>
            <li class="flex items-start justify-between gap-3">
              <span class="text-sm text-[var(--ono-text)]">Activate controls</span>
              <div class="flex items-center gap-1 shrink-0">
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Enter</kbd>
                <span class="text-[11px] text-[var(--ono-text-muted)]">or</span>
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Space</kbd>
              </div>
            </li>
            <li class="flex items-start justify-between gap-3">
              <span class="text-sm text-[var(--ono-text)]">Open this help</span>
              <div class="flex items-center gap-1 shrink-0">
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Shift</kbd>
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">/</kbd>
                <span class="text-[11px] text-[var(--ono-text-muted)]">( ? )</span>
              </div>
            </li>
            <li class="flex items-start justify-between gap-3">
              <span class="text-sm text-[var(--ono-text)]">Close dialogs</span>
              <div class="flex items-center gap-1 shrink-0">
                <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Esc</kbd>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    \`;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        window.showShortcutsModal();
      }
      if (e.key === 'Escape') {
        const modal = document.getElementById('ono-shortcuts-modal');
        if (modal && !hasClass(modal, 'hidden')) {
          window.hideShortcutsModal();
        }
      }
    });

    // Close modal when clicking outside
    document.addEventListener('click', function(e) {
      const modal = document.getElementById('ono-shortcuts-modal');
      if (modal && e.target === modal && !hasClass(modal, 'hidden')) {
        window.hideShortcutsModal();
      }
    });
  }

  // Initialize all components
  ready(function() {
    initThemeToggle();
    initTabs();
    initDropdowns();
    initClipboard();
    initShortcutsModal();
  });
})();
`;

type ErrorType = Error | SolutionError | VisulimaError;

const template = async (error: ErrorType, solutionFinders: SolutionFinder[] = [], options: TemplateOptions = {}): Promise<string> => {
    let html = "";

    const {
        code: { html: stackHtml, script: stackScript },
        id: stackId,
        name: stackName,
    } = await createStackPage(error, solutionFinders, options);

    const customPages = Array.isArray(options.content) ? options.content : [];
    const anyCustomSelected = customPages.some((p) => p.defaultSelected);
    const tabsList: HeaderTab[] = [];

    tabsList.push({ id: stackId, name: stackName, selected: !anyCustomSelected });

    for (const page of customPages) {
        const safeId = sanitizeHtml(page.id);
        const safeName = sanitizeHtml(String(page.name));

        tabsList.push({ id: safeId, name: safeName, selected: Boolean(page.defaultSelected) });
    }

    html += `<div class="flex flex-row gap-6 w-full mb-6">`;
    html += headerTabs(tabsList);

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;
    html += `</div>`;
    html += `<div id="ono-section-stack" class="${anyCustomSelected ? "hidden relative" : "relative"}" role="tabpanel" aria-labelledby="ono-tab-stack">${stackHtml}</div>`;

    for (const page of customPages) {
        const safeId = sanitizeHtml(page.id);
        const hidden = page.defaultSelected ? "" : " hidden";

        html += `<div id="ono-section-${safeId}" class="${hidden} relative" role="tabpanel" aria-labelledby="ono-tab-${safeId}">${page.code.html}</div>`;
    }

    return layout({
        content: html.trim(),
        cspNonce: options.cspNonce,
        css: inlineCss as string,
        description: "Error",
        error,
        scripts: [onoUIInit, headerBarScript, stackScript as string, ...customPages.map((p) => p.code.script || "")],
        title: "Error",
    });
};

export default template;
