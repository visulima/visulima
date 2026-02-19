/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import cn from "../../utils/cn";
import { useApps } from "../hooks/index";
import AppButton from "./app-button";

/**
 * Overflow "more apps" button
 */
const MoreButton = (): ComponentChildren => {
    const { toggleApp } = useApps();

    return (
        <button
            class={cn(
                "flex justify-center items-center w-10 h-10",
                "border-0 bg-transparent text-foreground/70 font-medium text-sm",
                "whitespace-nowrap no-underline p-0 m-0 overflow-hidden rounded-lg",
                "transition-all duration-200 ease-out cursor-pointer",
                "hover:bg-black/5 dark:hover:bg-white/8 hover:text-foreground",
                "active:bg-black/8 dark:active:bg-white/12 active:scale-95",
            )}
            data-app-id="dev-toolbar:more"
            onClick={() => {
                toggleApp("dev-toolbar:more").catch((error) => {
                    console.error("[dev-toolbar] Failed to toggle more app:", error);
                });
            }}
            type="button"
        >
            <div class="relative w-5 h-5 flex items-center justify-center select-none">⋯</div>
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
 * Toolbar bar component with app buttons.
 * All positions use flex-row; left/right positions rotate the pill 90deg via CSS
 * so the row appears vertical on screen.
 */
const ToolbarBar = ({ customAppsToShow = 3 }: ToolbarBarProps): ComponentChildren => {
    const { apps } = useApps();

    const builtInApps = apps.filter((app) => app.builtIn);
    const customApps = apps.filter((app) => !app.builtIn);
    const visibleApps = [...builtInApps, ...customApps.slice(0, customAppsToShow)];
    const overflowApps = customApps.slice(customAppsToShow);

    return (
        <div class="flex items-center justify-center overflow-visible pointer-events-auto rounded-xl" id="dev-bar">
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
