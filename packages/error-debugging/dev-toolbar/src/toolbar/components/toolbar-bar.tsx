/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import moreHorizontalIcon from "lucide-static/icons/more-horizontal.svg?data-uri&encoding=css";

import Icon from "../../ui/components/icon";
import cn from "../../utils/cn";
import { useApps } from "../hooks/index";
import AppButton from "./app-button";
import ViteOverlayButton from "./vite-overlay-button";

/**
 * Overflow "more apps" button — same visual style as AppButton.
 * Matches Nuxt DevTools: 30px circle, opacity 0.8 default.
 */
const MoreButton = (): ComponentChildren => {
    const { toggleApp } = useApps();

    return (
        <button
            class={cn(
                "relative flex justify-center items-center size-6",
                "border-0",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer",
                // Transparent default — flush on the bg-muted group
                "bg-transparent text-muted-foreground",
                "transition-all duration-150",
                "hover:bg-foreground/[0.08] hover:text-foreground",
                "active:scale-[0.94]",
                "group-data-[vertical]/panel:rotate-[-90deg]",
            )}
            data-app-id="dev-toolbar:more"
            onClick={() => {
                toggleApp("dev-toolbar:more").catch((error) => {
                    console.error("[dev-toolbar] Failed to toggle more app:", error);
                });
            }}
            title="More apps"
            type="button"
        >
            <div class="relative size-6 flex items-center justify-center select-none">
                <Icon size={16} src={moreHorizontalIcon} />
            </div>
        </button>
    );
};

interface ToolbarBarProps {
    /**
     * Number of custom apps to show before "more" button
     */
    customAppsToShow?: number;
}

/**
 * Toolbar bar — row of app buttons inside the pill.
 * Left/right placement rotates the whole pill 90deg via CSS,
 * so this always stays flex-row internally.
 */
const ToolbarBar = ({ customAppsToShow = 3 }: ToolbarBarProps): ComponentChildren => {
    const { apps } = useApps();

    const builtInApps = apps.filter((app) => app.builtIn);
    const customApps = apps.filter((app) => !app.builtIn);
    const visibleApps = [...builtInApps, ...customApps.slice(0, customAppsToShow)];
    const overflowApps = customApps.slice(customAppsToShow);

    return (
        <div class="flex items-center pointer-events-auto" id="__v_dt__bar">
            <div class="flex flex-row items-center justify-start gap-1" id="__v_dt__bar_container">
                {visibleApps.map((app) => (
                    <AppButton key={app.id} app={app} />
                ))}
                {overflowApps.length > 0 && <MoreButton />}
                <ViteOverlayButton />
            </div>
        </div>
    );
};

export default ToolbarBar;
