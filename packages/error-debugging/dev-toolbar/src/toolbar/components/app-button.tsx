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
                "relative flex justify-center items-center",
                "border-0 rounded-md",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer",
                // Transparent default — tiles sit flush on the bg-secondary group
                "bg-transparent text-muted-foreground",
                "transition-all duration-150",
                "hover:bg-foreground/[0.10] hover:text-foreground",
                "active:scale-[0.94]",
                // Active: clear highlight — unmissable against the secondary group bg
                app.active && "bg-foreground/[0.18] text-foreground",
                "group-data-[vertical]/panel:rotate-[-90deg]",
            )}
            data-app-id={app.id}
            onClick={handleClick}
            title={app.name}
            type="button"
        >
            {/* Icon + notification badge */}
            <div class="relative size-6 select-none flex items-center justify-center">
                <div class="size-6 flex items-center justify-center [&_svg]:size-4.5" dangerouslySetInnerHTML={{ __html: app.icon }} />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-1 -right-1 size-1.5 rounded-full border border-background",
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
