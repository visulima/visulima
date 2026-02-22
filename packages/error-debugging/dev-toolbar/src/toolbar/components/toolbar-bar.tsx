/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import cn from "../../utils/cn";
import { useApps } from "../hooks/index";
import AppButton from "./app-button";

/**
 * Overflow "more apps" button — same visual style as AppButton
 */
const MoreButton = (): ComponentChildren => {
    const { toggleApp } = useApps();
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <button
            class={cn(
                // 26px matches AppButton size in 30px pill
                "relative flex justify-center items-center w-[26px] h-[26px]",
                "border-0 rounded-full",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer overflow-visible",
                "text-foreground/50",
                "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                "opacity-80 hover:opacity-100 hover:bg-foreground/[0.05] hover:text-foreground",
                "active:scale-[0.94]",
                "group-data-[vertical]/panel:rotate-[-90deg]",
            )}
            data-app-id="dev-toolbar:more"
            onClick={() => {
                toggleApp("dev-toolbar:more").catch((error) => {
                    console.error("[dev-toolbar] Failed to toggle more app:", error);
                });
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            title="More apps"
            type="button"
        >
            <div class="relative w-[14px] h-[14px] flex items-center justify-center select-none">
                <svg fill="currentColor" height="14" viewBox="0 0 16 16" width="14">
                    <circle cx="3" cy="8" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="13" cy="8" r="1.5" />
                </svg>
            </div>

            {/* Tooltip — Nuxt DevTools style */}
            <div
                class={cn(
                    "absolute bottom-[calc(100%+0.6rem)] left-1/2 -translate-x-1/2",
                    "pointer-events-none z-10",
                    "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    showTooltip ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95",
                )}
            >
                <div class="whitespace-nowrap text-[0.7rem] font-medium font-sans bg-background/90 backdrop-blur-[10px] text-foreground/80 px-2.5 py-1 rounded-md border border-[rgba(125,125,125,0.2)] shadow-md">
                    More apps
                </div>
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
        <div class="flex items-center overflow-visible pointer-events-auto" id="dev-bar">
            <div class="flex flex-row items-center justify-start gap-0.5" id="bar-container">
                {visibleApps.map((app) => (
                    <AppButton key={app.id} app={app} />
                ))}
                {overflowApps.length > 0 && <MoreButton />}
            </div>
        </div>
    );
};

export default ToolbarBar;
