/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import cn from "../../utils/cn";
import { useApps } from "../hooks/index";
import AppButton from "./app-button";

/**
 * Overflow "more apps" button — same visual style as AppButton.
 * Matches Nuxt DevTools: 30px circle, opacity 0.8 default.
 */
const MoreButton = (): ComponentChildren => {
    const { toggleApp } = useApps();

    return (
        <button
            class={cn(
                // 30px = Nuxt DevTools icon-button exact size
                "relative flex justify-center items-center w-[30px] h-[30px]",
                "border-0 rounded-full",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer",
                "text-foreground/50",
                "transition-opacity duration-200 ease-in-out",
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
            title="More apps"
            type="button"
        >
            {/* 18px = 1.2em at Nuxt's 15px base font */}
            <div class="relative w-[18px] h-[18px] flex items-center justify-center select-none">
                <svg fill="currentColor" height="18" viewBox="0 0 16 16" width="18">
                    <circle cx="3" cy="8" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="13" cy="8" r="1.5" />
                </svg>
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
        <div class="flex items-center pointer-events-auto" id="dev-bar">
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
