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
                "relative flex justify-center items-center w-8 h-8",
                "border-0",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer overflow-visible",
                // Base: faded when inactive
                "text-foreground/60",
                "transition-[background,opacity,color,transform,border-radius] duration-150",
                "hover:bg-foreground/[0.06] hover:text-foreground",
                "active:scale-[0.92]",
                // Shape: rounded-full when active, rounded-xl otherwise
                app.active ? "rounded-full" : "rounded-xl",
                // Active: indigo primary chip
                app.active && [
                    "opacity-100!",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90! hover:text-primary-foreground!",
                ],
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
            <div class="relative w-4 h-4 select-none flex items-center justify-center">
                <div
                    class="w-4 h-4 block m-auto [&_svg]:w-4 [&_svg]:h-4"
                    dangerouslySetInnerHTML={{ __html: app.icon }}
                />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full ring-1 ring-background",
                            app.notification.level === "error" && "bg-destructive",
                            app.notification.level === "warning" && "bg-warning",
                            (!app.notification.level || app.notification.level === "info") && "bg-info",
                        )}
                        data-level={app.notification.level || "info"}
                    />
                )}
            </div>

            {/* Tooltip — light pill, no arrow */}
            <div
                class={cn(
                    "absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2",
                    "pointer-events-none z-10",
                    "transition-[opacity,transform] duration-[140ms] ease-out",
                    showTooltip ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
                )}
            >
                <div class="whitespace-nowrap text-[0.6875rem] font-medium font-sans bg-background text-foreground px-2.5 py-1 rounded-full border border-border shadow-md">
                    {app.name}
                </div>
            </div>
        </button>
    );
};

export default AppButton;
