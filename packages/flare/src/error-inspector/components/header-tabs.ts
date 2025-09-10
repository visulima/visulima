// eslint-disable-next-line import/no-extraneous-dependencies
import blocksIcon from "lucide-static/icons/blocks.svg?data-uri&encoding=css";
import layersIcon from "lucide-static/icons/layers.svg?data-uri&encoding=css";
import isquareDashedIcon from "lucide-static/icons/square-dashed.svg?data-uri&encoding=css";
import cn from "../util/tw";
import { sanitizeAttr, sanitizeHtml } from "../util/sanitize";

export type HeaderTab = { id: string; name: string; selected?: boolean; icon?: string };

export const headerTabs = (tabs: HeaderTab[]): string => {
    const getIcon = (tab: HeaderTab): string => {
        if (tab.icon) {
            return sanitizeHtml(tab.icon);
        }

        switch (tab.id) {
            case "stack":
                return layersIcon;
            case "context":
                return blocksIcon;
            default:
                return isquareDashedIcon;
        }
    };

    return `<nav class="flex gap-1 p-1 rounded-[var(--flare-radius-md)] bg-[var(--flare-surface-muted)] shadow-[var(--flare-elevation-1)]" role="tablist">
    ${tabs
        .map((t) => {
            const base =
                "relative px-3 py-1.5 rounded-[var(--flare-radius-md)] text-sm font-medium cursor-pointer text-[var(--flare-text-muted)] dark:text-[var(--flare-neutral)] transition-all duration-150 hover:text-[var(--flare-text)] hover:bg-[var(--flare-surface)] focus:outline-hidden focus:ring-2 ring-[var(--flare-red-orange)] inline-flex gap-2 items-center";
            const active =
                "hs-tab-active:bg-[var(--flare-surface)] hs-tab-active:text-[var(--flare-text)] hs-tab-active:shadow-[var(--flare-elevation-1)] hs-tab-active:ring-2";

            const classes = cn(base, active, t.selected ? "active" : "", "[:>svg]:size-4");

            const safeId = sanitizeAttr(t.id);
            const safeName = sanitizeHtml(t.name);

            return `<button type="button" class="${classes}" id="flare-tab-${safeId}" aria-selected="${t.selected ? "true" : "false"}" data-hs-tab="#flare-section-${safeId}" aria-controls="flare-section-${safeId}" role="tab">${getIcon(t)}<span>${safeName}</span></button>`;
        })
        .join("")}
  </nav>
`;
};
