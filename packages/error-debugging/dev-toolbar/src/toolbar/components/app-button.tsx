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

    /**
     * Whether button should be horizontal (for right-side placement)
     */
    isHorizontal?: boolean;
}

/**
 * App button component
 */
const AppButton = ({ app, isHorizontal = false }: AppButtonProps): ComponentChildren => {
    const { toggleApp } = useApps();

    const handleClick = (): void => {
        toggleApp(app.id).catch((error) => {
            console.error(`[dev-toolbar] Failed to toggle app ${app.id}:`, error);
        });
    };

    const buttonClasses = isHorizontal ? "flex justify-center items-center h-11 w-10" : "flex justify-center items-center w-11 h-10";

    return (
        <button
            class={cn(
                buttonClasses,
                "border-0 bg-transparent text-white font-sans text-base leading-tight whitespace-nowrap no-underline p-0 m-0 overflow-hidden transition-opacity duration-200 ease-out cursor-pointer",
                "hover:bg-white/12.5 focus-visible:bg-white/12.5 focus-visible:-outline-offset-3",
                app.active && "bg-[rgba(71,78,94,1)]",
            )}
            data-app-id={app.id}
            onClick={handleClick}
            type="button"
        >
            <div class="relative max-w-5 max-h-5 select-none">
                <div class="w-5 h-5 block m-auto" dangerouslySetInnerHTML={{ __html: app.icon }} />
                {app.notification.state && (
                    <span
                        class={cn("absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500", app.notification.state ? "block" : "hidden")}
                        data-level={app.notification.level || "info"}
                    />
                )}
            </div>
        </button>
    );
};

export default AppButton;
