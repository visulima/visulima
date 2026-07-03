/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";

import type { DevToolbarAppState } from "../../types/index";
import { useToolbarContext } from "../context/index";
import { useApps } from "../hooks/index";

interface AppButtonProps {
    /**
     * App state
     */
    app: DevToolbarAppState;
}

/**
 * App button component — shown in the toolbar pill.
 * When an app declares a `tooltip` component, hovering the button shows a live
 * mini-canvas via AppTooltipOverlay (rendered outside overflow:hidden pill).
 * @param props Component props
 * @param props.app App state
 * @returns Rendered button component
 */
const AppButton = ({ app }: AppButtonProps): ComponentChildren => {
    const { toggleApp } = useApps();
    const { isVisible, setHoveredApp } = useToolbarContext();
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleClick = (): void => {
        // Dismiss the hover tooltip immediately — mouseLeave may not fire when
        // the user clicks without moving the cursor off the button first.
        setHoveredApp(undefined);
        toggleApp(app.id).catch((error) => {
            console.error(`[dev-toolbar] Failed to toggle app ${app.id}:`, error);
        });
    };

    const handleMouseEnter = (): void => {
        // Don't show hover tooltip when the canvas panel is open
        if (!app.tooltip || isVisible) {
            return;
        }

        setHoveredApp(app, buttonRef.current?.getBoundingClientRect());
    };

    const handleMouseLeave = (): void => {
        if (!app.tooltip) {
            return;
        }

        setHoveredApp(undefined);
    };

    return (
        <button
            aria-label={app.name}
            class={clsx(
                "relative flex justify-center items-center",
                "border-0",
                "whitespace-nowrap no-underline p-0 m-0",
                "cursor-pointer",
                "bg-transparent text-muted-foreground",
                "transition-all duration-150",
                "hover:bg-primary/8 hover:text-primary",
                "active:scale-[0.94]",
                // Active: primary highlight
                app.active && "bg-primary/12 text-primary",
                "group-data-[vertical]/panel:rotate-[-90deg]",
            )}
            data-app-id={app.id}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={buttonRef}
            // Suppress native tooltip when the app provides its own rich tooltip
            title={app.tooltip ? undefined : app.name}
            type="button"
        >
            {/* Icon + notification badge */}
            <div class="relative size-6 select-none flex items-center justify-center">
                {/* App SVG icon — content comes from the app's own icon string (trusted developer-authored SVG) */}
                <div class="size-6 flex items-center justify-center [&_svg]:size-4.5" dangerouslySetInnerHTML={{ __html: app.icon }} />
                {app.notification.state && (
                    <span
                        class={clsx(
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
