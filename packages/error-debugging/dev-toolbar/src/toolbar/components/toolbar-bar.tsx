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
                "relative flex justify-center items-center w-9 h-9",
                "border-0 rounded-lg",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer overflow-visible",
                "text-foreground opacity-50",
                "transition-[background,opacity,color,transform] duration-150",
                "hover:bg-black/[6%] hover:opacity-85 dark:hover:bg-white/[9%]",
                "active:opacity-70 active:scale-[0.92]",
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
            <div class="relative w-[18px] h-[18px] flex items-center justify-center select-none">
                <svg fill="currentColor" height="16" viewBox="0 0 16 16" width="16">
                    <circle cx="3" cy="8" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="13" cy="8" r="1.5" />
                </svg>
            </div>

            {/* Tooltip */}
            <div
                class={cn(
                    "absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
                    "flex flex-col items-center pointer-events-none z-10",
                    "transition-[opacity,transform] duration-[140ms] ease-out",
                    showTooltip ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
                )}
            >
                <div class="whitespace-nowrap text-[11px] font-medium tracking-[0.01em] font-sans bg-[oklch(13%_0.01_264)] text-[oklch(96%_0_0)] px-[9px] py-[3px] rounded-md dark:bg-[oklch(88%_0.01_264)] dark:text-[oklch(13%_0.01_264)]">
                    More apps
                </div>
                <div class="w-0 h-0 border-solid border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[oklch(13%_0.01_264)] border-b-0 dark:border-t-[oklch(88%_0.01_264)]" />
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
