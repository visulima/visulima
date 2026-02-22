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
                // 26px = Nuxt DevTools icon-button size inside 30px pill (2px padding each side)
                "relative flex justify-center items-center w-[26px] h-[26px]",
                "border-0 rounded-full",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer overflow-visible",
                "bg-transparent text-foreground/50",
                "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                // Nuxt DevTools: opacity 0.8 default, 1.0 on hover
                "opacity-80 hover:opacity-100 hover:bg-foreground/[0.05] hover:text-foreground",
                "active:scale-[0.94]",
                // Active: subtle fill (Nuxt DevTools style — no bold dark/white circle)
                app.active && "bg-foreground/[0.07] text-foreground opacity-100",
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
            <div class="relative w-[14px] h-[14px] select-none flex items-center justify-center">
                <div
                    class="w-[14px] h-[14px] block m-auto [&_svg]:w-[14px] [&_svg]:h-[14px] transition-transform duration-300"
                    dangerouslySetInnerHTML={{ __html: app.icon }}
                />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background",
                            app.notification.level === "error" && "bg-destructive",
                            app.notification.level === "warning" && "bg-warning",
                            (!app.notification.level || app.notification.level === "info") && "bg-info",
                        )}
                        data-level={app.notification.level || "info"}
                    />
                )}
            </div>

            {/* Tooltip — Nuxt DevTools style: rounded-md, uniform rgba border, glass bg */}
            <div
                class={cn(
                    "absolute bottom-[calc(100%+0.6rem)] left-1/2 -translate-x-1/2",
                    "pointer-events-none z-10",
                    "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    showTooltip ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95",
                )}
            >
                <div class="whitespace-nowrap text-[0.7rem] font-medium font-sans bg-background/90 backdrop-blur-[10px] text-foreground/80 px-2.5 py-1 rounded-md border border-[rgba(125,125,125,0.2)] shadow-md">
                    {app.name}
                </div>
            </div>
        </button>
    );
};

export default AppButton;
