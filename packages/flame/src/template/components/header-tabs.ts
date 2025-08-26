// eslint-disable-next-line import/no-extraneous-dependencies
import blocksIcon from "lucide-static/icons/blocks.svg?raw";
import layersIcon from "lucide-static/icons/layers.svg?raw";
import isquareDashedIcon from "lucide-static/icons/square-dashed.svg?raw";
import cn from "../util/tw";

export type HeaderTab = { id: string; name: string; selected?: boolean; icon?: string };

export const headerTabs = (tabs: HeaderTab[]): string => {
    const getIcon = (tab: HeaderTab): string => {
        if (tab.icon) {
            return tab.icon;
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

    return `<nav class="flex gap-1 p-1 rounded-[var(--flame-radius-md)] bg-[var(--flame-surface-muted)] shadow-[var(--flame-elevation-1)]" role="tablist">
    ${tabs
        .map((t) => {
            const base =
                "relative px-3 py-1.5 rounded-[var(--flame-radius-md)] text-sm font-medium cursor-pointer text-[var(--flame-text-muted)] transition-all duration-150 hover:text-[var(--flame-text)] hover:bg-[var(--flame-surface)] focus:outline-hidden focus:ring-2 ring-[var(--flame-red-orange)] inline-flex gap-2 items-center";
            const active =
                "hs-tab-active:bg-[var(--flame-surface)] hs-tab-active:text-[var(--flame-text)] hs-tab-active:shadow-[var(--flame-elevation-1)] hs-tab-active:ring-2";

            const classes = cn(base, active, t.selected ? "active" : "", "[:>svg]:size-4");

            return `<button type="button" class="${classes}" id="flame-tab-${t.id}" aria-selected="${t.selected ? "true" : "false"}" data-hs-tab="#flame-section-${t.id}" aria-controls="flame-section-${t.id}" role="tab">${getIcon(t)}<span>${t.name}</span></button>`;
        })
        .join("")}
  </nav>
`;
};
