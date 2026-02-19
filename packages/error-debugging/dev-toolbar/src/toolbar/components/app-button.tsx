/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import type { DevToolbarAppState } from "../../types/index";
import cn from "../../utils/cn";
import { useApps } from "../hooks/index";

interface AppButtonProps {
    /**
     * App state
     */
    app: DevToolbarAppState;
}

/**
 * App button component — shown in the toolbar pill.
 * Tooltip is rendered as a JSX child (no CSS pseudo-elements needed).
 */
const AppButton = ({ app }: AppButtonProps): ComponentChildren => {
    const { toggleApp } = useApps();
    const [showTooltip, setShowTooltip] = useState(false);

    const handleClick = (): void => {
        toggleApp(app.id).catch((error) => {
            console.error(`[dev-toolbar] Failed to toggle app ${app.id}:`, error);
        });
    };

    return (
        <button
            aria-label={app.name}
            class={cn(
                "relative flex justify-center items-center w-9 h-9",
                "border-0 rounded-full",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer overflow-visible",
                "bg-transparent text-zinc-400 dark:text-zinc-500",
                "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                "hover:bg-zinc-900/5 hover:text-zinc-900 dark:hover:bg-zinc-50/10 dark:hover:text-zinc-50",
                "active:scale-[0.94]",
                // Active: dark circle in light mode, light circle in dark mode (mirrors logo button)
                app.active && ["bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900", "shadow-sm opacity-100!"],
                // Counter-rotate when pill is in vertical mode
                "group-data-[vertical]/panel:rotate-[-90deg]",
            )}
            data-app-id={app.id}
            onClick={handleClick}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            type="button"
        >
            {/* Icon + notification badge */}
            <div class="relative w-4.5 h-4.5 select-none flex items-center justify-center">
                <div
                    class="w-4.5 h-4.5 block m-auto [&_svg]:w-4.5 [&_svg]:h-4.5 transition-transform duration-300"
                    dangerouslySetInnerHTML={{ __html: app.icon }}
                />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-pill",
                            app.notification.level === "error" && "bg-destructive",
                            app.notification.level === "warning" && "bg-warning",
                            (!app.notification.level || app.notification.level === "info") && "bg-info",
                        )}
                        data-level={app.notification.level || "info"}
                    />
                )}
            </div>

            {/* Tooltip — clean pill at top, matching image */}
            <div
                class={cn(
                    "absolute bottom-[calc(100%+0.8rem)] left-1/2 -translate-x-1/2",
                    "pointer-events-none z-10",
                    "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    showTooltip ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95",
                )}
            >
                <div class="whitespace-nowrap text-[0.7rem] font-medium font-sans bg-pill text-foreground/80 px-3 py-1 rounded-full border border-pill-border shadow-sm backdrop-blur-sm">
                    {app.name}
                </div>
            </div>
        </button>
    );
};

export default AppButton;
