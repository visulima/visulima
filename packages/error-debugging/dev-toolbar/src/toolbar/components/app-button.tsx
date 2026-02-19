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
                "border-0 rounded-lg",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer overflow-visible",
                // Base: faded when inactive
                "text-foreground opacity-50",
                "transition-[background,opacity,color,transform] duration-150",
                "hover:bg-black/[6%] hover:opacity-85 dark:hover:bg-white/[9%]",
                "active:opacity-70 active:scale-[0.92]",
                // Active: dark chip (Figma/Excalidraw style — inverts icon to white)
                app.active && [
                    "opacity-100!",
                    "bg-[oklch(13%_0.01_264)] text-[oklch(98%_0_0)]",
                    "hover:bg-[oklch(22%_0.01_264)]! hover:opacity-100!",
                    "dark:bg-[oklch(30%_0.02_264)] dark:text-[oklch(94%_0.01_264)]",
                    "dark:hover:bg-[oklch(36%_0.02_264)]!",
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
            <div class="relative w-[18px] h-[18px] select-none flex items-center justify-center">
                <div
                    class="w-[18px] h-[18px] block m-auto [&_svg]:w-[18px] [&_svg]:h-[18px]"
                    dangerouslySetInnerHTML={{ __html: app.icon }}
                />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-1 -right-1.5 w-[7px] h-[7px] rounded-full ring-[1.5px] ring-background",
                            app.notification.level === "error" && "bg-destructive",
                            app.notification.level === "warning" && "bg-warning",
                            (!app.notification.level || app.notification.level === "info") && "bg-info",
                        )}
                        data-level={app.notification.level || "info"}
                    />
                )}
            </div>

            {/* Tooltip label + arrow — always mounted, toggled via opacity/translate */}
            <div
                class={cn(
                    "absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
                    "flex flex-col items-center pointer-events-none z-10",
                    "transition-[opacity,transform] duration-[140ms] ease-out",
                    showTooltip ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
                )}
            >
                <div class="whitespace-nowrap text-[11px] font-medium tracking-[0.01em] font-sans bg-[oklch(13%_0.01_264)] text-[oklch(96%_0_0)] px-[9px] py-[3px] rounded-md dark:bg-[oklch(88%_0.01_264)] dark:text-[oklch(13%_0.01_264)]">
                    {app.name}
                </div>
                {/* Downward-pointing arrow triangle */}
                <div class="w-0 h-0 border-solid border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[oklch(13%_0.01_264)] border-b-0 dark:border-t-[oklch(88%_0.01_264)]" />
            </div>
        </button>
    );
};

export default AppButton;
