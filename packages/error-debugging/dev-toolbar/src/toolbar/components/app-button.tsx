/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

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
 * Matches Nuxt DevTools exactly: 30px circle, opacity 0.8 default, no bg.
 * Pill has overflow:hidden so no custom tooltip needed — uses native title.
 */
const AppButton = ({ app }: AppButtonProps): ComponentChildren => {
    const { toggleApp } = useApps();

    const handleClick = (): void => {
        toggleApp(app.id).catch((error) => {
            console.error(`[dev-toolbar] Failed to toggle app ${app.id}:`, error);
        });
    };

    return (
        <button
            aria-label={app.name}
            class={cn(
                // 30px = Nuxt DevTools icon-button exact size (fills the 30px pill height)
                "relative flex justify-center items-center w-[30px] h-[30px]",
                "border-0 rounded-full",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer",
                "bg-transparent text-foreground/50",
                // Nuxt DevTools: opacity 0.2s ease-in-out transition
                "transition-opacity duration-200 ease-in-out",
                // Nuxt DevTools: opacity 0.8 default, 1.0 on hover
                "opacity-80 hover:opacity-100 hover:bg-foreground/[0.05] hover:text-foreground",
                "active:scale-[0.94]",
                // Active: subtle fill (Nuxt DevTools style)
                app.active && "bg-foreground/[0.07] text-foreground opacity-100",
                // Counter-rotate when pill is in vertical mode
                "group-data-[vertical]/panel:rotate-[-90deg]",
            )}
            data-app-id={app.id}
            onClick={handleClick}
            title={app.name}
            type="button"
        >
            {/* Icon + notification badge — 18px = 1.2em at Nuxt's 15px base font */}
            <div class="relative w-[18px] h-[18px] select-none flex items-center justify-center">
                <div
                    class="w-[18px] h-[18px] block m-auto [&_svg]:w-[18px] [&_svg]:h-[18px]"
                    dangerouslySetInnerHTML={{ __html: app.icon }}
                />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full border border-background",
                            app.notification.level === "error" && "bg-destructive",
                            app.notification.level === "warning" && "bg-warning",
                            (!app.notification.level || app.notification.level === "info") && "bg-info",
                        )}
                        data-level={app.notification.level || "info"}
                    />
                )}
            </div>
        </button>
    );
};

export default AppButton;
