import type { VisulimaError } from "@visulima/error/error";
import type { SolutionError, SolutionFinder } from "@visulima/error/solution";

import headerBar from "./components/header-bar";
import type { HeaderTab } from "./components/header-tabs";
import { headerTabs } from "./components/header-tabs";
import inlineCss from "./index.css";
import layout from "./layout";
import createStackPage from "./page/stack";
import type { TemplateOptions } from "./types";
import { sanitizeHtml, sanitizeOptions } from "./utils/sanitize";

const domUtilitiesScript = `
// DOM utility functions
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
`;

const copyDropdownScript = `
// Enhanced clipboard and dropdown functionality

// Clipboard functionality
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

// Dropdown system
let activeDropdown = null;

function toggleDropdown(trigger) {
  const dropdown = trigger.closest('.ono-dropdown');
  if (!dropdown) {
    console.warn('Copy dropdown: No dropdown container found');
    return;
  }

  const menu = $('.ono-dropdown-menu', dropdown);
  if (!menu) {
    console.warn('Copy dropdown: No dropdown menu found');
    return;
  }

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

// Event listeners
document.addEventListener('click', function(e) {
  const trigger = e.target.closest('.ono-dropdown-toggle');
  if (trigger) {
    console.log('Copy dropdown: Click detected on toggle button');
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

// Handle dropdown copy menu items
document.addEventListener('click', function(e) {
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

ready(function() {
  console.log('Copy dropdown: Script initialized and ready');
  // Dropdown and clipboard initialization complete
});
`;

const shortcutsModalScript = `
// Shortcuts modal functionality

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
    addClass(modal, 'flex');
    modal.focus();
  }
};

window.hideShortcutsModal = function() {
  const modal = document.getElementById('ono-shortcuts-modal');
  if (modal) {
    addClass(modal, 'hidden');
    removeClass(modal, 'flex');

    // Restore body scrolling
    document.body.style.overflow = originalBodyOverflow;
    originalBodyOverflow = '';
  }
};

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

ready(function() {
  // Shortcuts modal initialization complete
});
`;

const copyButtonScript = `
// Clipboard functionality for copy buttons
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
});
`;

type ErrorType = Error | SolutionError | VisulimaError;

// Main template function that generates the complete error inspector HTML page
const template = async (error: ErrorType, solutionFinders: SolutionFinder[] = [], options: TemplateOptions = {}): Promise<string> => {
    // Input validation
    if (!error) {
        throw new TypeError("Error parameter is required");
    }

    if (!Array.isArray(solutionFinders)) {
        throw new TypeError("solutionFinders must be an array");
    }

    // Sanitize user-controlled options to prevent XSS
    const sanitizedOptions = sanitizeOptions(options);

    let html = "";

    const {
        code: { html: stackHtml, script: stackScript },
        id: stackId,
        name: stackName,
    } = await createStackPage(error, solutionFinders, sanitizedOptions);

    const customPages = Array.isArray(sanitizedOptions.content) ? sanitizedOptions.content : [];
    const anyCustomSelected = customPages.some((p) => p.defaultSelected);
    const tabsList: HeaderTab[] = [];

    tabsList.push({ id: stackId, name: stackName, selected: !anyCustomSelected });

    for (const page of customPages) {
        const safeId = sanitizeHtml(page.id);
        const safeName = sanitizeHtml(String(page.name));

        tabsList.push({ id: safeId, name: safeName, selected: Boolean(page.defaultSelected) });
    }

    const headerTabsResult = headerTabs(tabsList);

    html += `<div class="flex flex-row gap-6 w-full mb-6">`;
    html += headerTabsResult.html;

    const headerBarResult = headerBar(sanitizedOptions);

    html += headerBarResult.html;
    html += `</div>`;
    html += `<div id="ono-section-stack" class="${anyCustomSelected ? "hidden relative" : "relative"}" role="tabpanel" aria-labelledby="ono-tab-stack">${stackHtml}</div>`;

    for (const page of customPages) {
        const safeId = sanitizeHtml(page.id);
        const hidden = page.defaultSelected ? "" : " hidden";

        html += `<div id="ono-section-${safeId}" class="${hidden} relative" role="tabpanel" aria-labelledby="ono-tab-${safeId}">${page.code.html}</div>`;
    }

    return layout({
        content: html.trim(),
        cspNonce: options?.cspNonce,
        css: inlineCss as string,
        description: "Error",
        error,
        scripts: [
            domUtilitiesScript,
            copyDropdownScript,
            shortcutsModalScript,
            copyButtonScript,
            headerTabsResult.script,
            headerBarResult.script,
            stackScript as string,
            ...customPages.map((p) => p.code.script || ""),
        ].filter(Boolean),
        theme: options?.theme,
        title: "Error",
    });
};

export default template;
