// eslint-disable-next-line import/no-extraneous-dependencies
import blocksIcon from "lucide-static/icons/blocks.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import layersIcon from "lucide-static/icons/layers.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import isquareDashedIcon from "lucide-static/icons/square-dashed.svg?raw";

import { sanitizeAttribute, sanitizeHtml } from "../util/sanitize";
import cn from "../util/tw";

export type HeaderTab = { icon?: string; id: string; name: string; selected?: boolean };

export const headerTabs = (tabs: HeaderTab[]): { html: string; script: string } => {
    const getIcon = (tab: HeaderTab): string => {
        if (tab.icon) {
            return sanitizeHtml(tab.icon);
        }

        switch (tab.id) {
            case "context": {
                return blocksIcon;
            }
            case "stack": {
                return layersIcon;
            }
            default: {
                return isquareDashedIcon;
            }
        }
    };

    const html = `<nav class="flex gap-1 p-1 rounded-[var(--ono-radius-md)] bg-[var(--ono-surface-muted)] shadow-[var(--ono-elevation-1)]" role="tablist">
    ${tabs
        .map((t) => {
            const base
                = "relative px-3 py-1.5 rounded-[var(--ono-radius-md)] text-sm font-medium cursor-pointer text-[var(--ono-text-muted)] dark:text-[var(--ono-neutral)] transition-all duration-150 hover:text-[var(--ono-text)] hover:bg-[var(--ono-surface)] focus:outline-hidden focus:ring-2 ring-[var(--ono-red-orange)] inline-flex gap-2 items-center";
            const active = "active:bg-[var(--ono-surface)] active:text-[var(--ono-text)] active:shadow-[var(--ono-elevation-1)] active:ring-2";

            const classes = cn(base, active, t.selected ? "active" : "", "[:>svg]:size-4");

            const safeId = sanitizeAttribute(t.id);
            const safeName = sanitizeHtml(t.name);

            return `<button type="button" class="${classes}" id="ono-tab-${safeId}" aria-selected="${t.selected ? "true" : "false"}" data-ono-tab="#ono-section-${safeId}" aria-controls="ono-section-${safeId}" role="tab" title="${safeName}">${getIcon(t)}<span>${safeName}</span></button>`;
        })
        .join("")}
  </nav>`;

    return {
        html,
        script: `
// Tabs system initialization
(function() {
  'use strict';


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
  ready(function() {
    const activeTab = $('[role="tab"][aria-selected="true"]');
    if (activeTab) {
      activateTab(activeTab);
    }
  });
})();
`,
    };
};
