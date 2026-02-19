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
 * App button component
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
            class={cn(
                "flex justify-center items-center w-10 h-10",
                "border-0 bg-transparent text-foreground/70 rounded-lg",
                "whitespace-nowrap no-underline p-0 m-0 overflow-hidden",
                "transition-all duration-200 ease-out cursor-pointer",
                "hover:bg-black/5 dark:hover:bg-white/8 hover:text-foreground",
                "active:bg-black/8 dark:active:bg-white/12 active:scale-95",
                app.active && "bg-black/8 dark:bg-white/12 text-foreground",
            )}
            data-app-id={app.id}
            onClick={handleClick}
            type="button"
        >
            <div class="relative w-5 h-5 select-none flex items-center justify-center">
                <div class="w-5 h-5 block m-auto [&_svg]:w-5 [&_svg]:h-5" dangerouslySetInnerHTML={{ __html: app.icon }} />
                {app.notification.state && (
                    <span
                        class={cn(
                            "absolute -top-1 -right-1.5 w-2 h-2 rounded-full ring-2 ring-background",
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
