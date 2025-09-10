// eslint-disable-next-line import/no-extraneous-dependencies
import blocksIcon from "lucide-static/icons/blocks.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import layersIcon from "lucide-static/icons/layers.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import isquareDashedIcon from "lucide-static/icons/square-dashed.svg?raw";

import { sanitizeAttr as sanitizeAttribute, sanitizeHtml } from "../util/sanitize";
import cn from "../util/tw";

export type HeaderTab = { icon?: string; id: string; name: string; selected?: boolean };

export const headerTabs = (tabs: HeaderTab[]): string => {
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

    return `<nav class="flex gap-1 p-1 rounded-[var(--ono-radius-md)] bg-[var(--ono-surface-muted)] shadow-[var(--ono-elevation-1)]" role="tablist">
    ${tabs
        .map((t) => {
            const base
                = "relative px-3 py-1.5 rounded-[var(--ono-radius-md)] text-sm font-medium cursor-pointer text-[var(--ono-text-muted)] dark:text-[var(--ono-neutral)] transition-all duration-150 hover:text-[var(--ono-text)] hover:bg-[var(--ono-surface)] focus:outline-hidden focus:ring-2 ring-[var(--ono-red-orange)] inline-flex gap-2 items-center";
            const active
                = "active:bg-[var(--ono-surface)] active:text-[var(--ono-text)] active:shadow-[var(--ono-elevation-1)] active:ring-2";

            const classes = cn(base, active, t.selected ? "active" : "", "[:>svg]:size-4");

            const safeId = sanitizeAttribute(t.id);
            const safeName = sanitizeHtml(t.name);

            return `<button type="button" class="${classes}" id="ono-tab-${safeId}" aria-selected="${t.selected ? "true" : "false"}" data-ono-tab="#ono-section-${safeId}" aria-controls="ono-section-${safeId}" role="tab" title="${safeName}">${getIcon(t)}<span>${safeName}</span></button>`;
        })
        .join("")}
  </nav>
`;
};
