/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { DevToolbarAppState } from "../../types/index";
import cn from "../../utils/cn";
import { createServerHelpers } from "../helpers";
import { sharedToolbarStylesheet } from "../stylesheet";

interface DevPanelProps {
    /**
     * Currently active app ID
     */
    activeAppId: string | null;

    /**
     * All registered apps
     */
    apps: DevToolbarAppState[];

    /**
     * Close the panel
     */
    onClose: () => void;

    /**
     * Toggle a specific app
     */
    onToggleApp: (appId: string) => Promise<void>;

    /**
     * Whether the panel is visible (toolbar open)
     */
    panelVisible: boolean;

    /**
     * Toolbar position - used to place the panel on the opposite side
     */
    position: "bottom" | "left" | "right" | "top";
}

/**
 * App content renderer - mounts app's component into shadow DOM
 */
const AppContent = ({ app }: { app: DevToolbarAppState }): ComponentChildren => {
    const contentRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!contentRef.current || initializedRef.current) {
            return;
        }

        const container = contentRef.current;

        if (app.component) {
            const helpers = createServerHelpers();

            render(<app.component eventTarget={app.eventTarget} helpers={helpers} />, container);
            initializedRef.current = true;

            return () => {
                render(null, container);
                initializedRef.current = false;
            };
        }

        if (app.init) {
            // For vanilla apps we create a shadow root on a host element
            const host = document.createElement("div");

            host.style.cssText = "width:100%;height:100%;";
            container.append(host);

            const shadowRoot = host.attachShadow({ mode: "open" });

            if (sharedToolbarStylesheet) {
                shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
            }

            const helpers = createServerHelpers();
            const result = app.init(shadowRoot, app.eventTarget, helpers);

            if (result && typeof (result as Promise<void>).then === "function") {
                (result as Promise<void>)
                    .then(() => {
                        initializedRef.current = true;
                    })
                    .catch((error) => {
                        console.error(`[dev-toolbar] Failed to init app ${app.id}:`, error);
                    });
            } else {
                initializedRef.current = true;
            }

            return () => {
                container.innerHTML = "";
                initializedRef.current = false;
            };
        }

        return undefined;
    }, [app]);

    return <div class="w-full h-full" ref={contentRef} />;
};

/**
 * Panel position classes based on toolbar side.
 * The panel fills the remaining screen space on the opposite side of the toolbar.
 */
const getPanelPositionClasses = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom": {
            // Toolbar at bottom → panel fills space above it
            return "bottom-12 left-4 right-4 top-4";
        }

        case "left": {
            // Toolbar at left → panel fills space to the right
            return "left-12 top-4 bottom-4 right-4";
        }

        case "right": {
            // Toolbar at right → panel fills space to the left
            return "right-12 top-4 bottom-4 left-4";
        }

        case "top": {
            // Toolbar at top → panel fills space below it
            return "top-12 left-4 right-4 bottom-4";
        }

        default: {
            return "bottom-12 left-4 right-4 top-4";
        }
    }
};

/**
 * Unified DevTools panel - sidebar navigation + content area.
 * Inspired by Vue DevTools / browser DevTools layout.
 */
const DevPanel = ({
    activeAppId,
    apps,
    onClose,
    onToggleApp,
    panelVisible,
    position,
}: DevPanelProps): ComponentChildren => {
    const [isVisible, setIsVisible] = useState(false);

    // Animate in/out with a small delay on hide to allow fade-out
    useEffect(() => {
        if (panelVisible) {
            setIsVisible(true);

            return undefined;
        }

        const timer = setTimeout(() => setIsVisible(false), 200);

        return () => clearTimeout(timer);
    }, [panelVisible]);

    // Escape key closes the panel
    useEffect(() => {
        if (!panelVisible) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [panelVisible, onClose]);

    const activeApp = useMemo(() => apps.find((a) => a.id === activeAppId), [apps, activeAppId]);
    const panelPositionClasses = getPanelPositionClasses(position);

    if (!isVisible) {
        return null;
    }

    return (
        <>
            {/* Backdrop - clicking closes the panel */}
            <div
                aria-hidden="true"
                class={cn(
                    "fixed inset-0 z-[2000000008]",
                    "transition-opacity duration-200",
                    panelVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                )}
                onClick={onClose}
                role="presentation"
            />

            {/* Unified DevTools panel */}
            <div
                aria-label="DevTools panel"
                aria-modal="true"
                class={cn(
                    "fixed z-[2000000009]",
                    panelPositionClasses,
                    "flex flex-row",
                    "bg-background",
                    "border border-border",
                    "rounded-lg shadow-xl",
                    "overflow-hidden",
                    "transition-all duration-200 ease-out",
                    panelVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
                )}
                role="dialog"
            >
                {/* Left sidebar - icon navigation for all apps */}
                <nav
                    aria-label="DevTools apps"
                    class="flex flex-col w-[52px] flex-shrink-0 bg-muted/30 py-2 overflow-y-auto"
                >
                    <div class="flex flex-col items-center gap-1 px-1.5">
                        {apps.map((app) => (
                            <div class="relative" key={app.id}>
                                <button
                                    aria-label={app.name}
                                    aria-pressed={activeAppId === app.id}
                                    class={cn(
                                        "relative flex items-center justify-center w-9 h-9 rounded-lg",
                                        "cursor-pointer border-0 bg-transparent transition-colors",
                                        activeAppId === app.id
                                            ? "bg-primary/15 text-primary hover:bg-primary/20"
                                            : "text-foreground/60 hover:bg-accent/80 hover:text-foreground",
                                    )}
                                    onClick={() => {
                                        // Clicking the already-active app in the sidebar does nothing
                                        if (app.id === activeAppId) {
                                            return;
                                        }

                                        onToggleApp(app.id).catch(console.error);
                                    }}
                                    title={app.name}
                                    type="button"
                                >
                                    {app.icon ? (
                                        <span
                                            class="w-5 h-5 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5"
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML={{ __html: app.icon }}
                                        />
                                    ) : (
                                        <span class="text-xs font-semibold uppercase">
                                            {app.name.slice(0, 2)}
                                        </span>
                                    )}
                                </button>

                                {/* Notification badge */}
                                {app.notification.state && (
                                    <span
                                        aria-hidden="true"
                                        class={cn(
                                            "pointer-events-none absolute top-0.5 right-0.5 w-2 h-2 rounded-full ring-1 ring-background",
                                            app.notification.level === "error"
                                                ? "bg-destructive"
                                                : app.notification.level === "warning"
                                                    ? "bg-warning"
                                                    : "bg-info",
                                        )}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Vertical divider */}
                <div aria-orientation="vertical" class="w-px flex-shrink-0 bg-border self-stretch" role="separator" />

                {/* Content area */}
                <div class="flex-1 flex flex-col min-w-0">
                    {/* Content header - shows active app name */}
                    {activeApp && (
                        <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border flex-shrink-0">
                            {activeApp.icon && (
                                <span
                                    class="w-4 h-4 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4 text-foreground/70 flex-shrink-0"
                                    dangerouslySetInnerHTML={{ __html: activeApp.icon }}
                                />
                            )}
                            <span class="text-sm font-medium text-foreground">{activeApp.name}</span>
                        </div>
                    )}

                    {/* App content - scrollable */}
                    <div class="flex-1 overflow-auto min-h-0">
                        {activeApp
                            ? (
                            <AppContent app={activeApp} key={activeApp.id} />
                            )
                            : (
                            <div class="flex items-center justify-center min-h-[200px] h-full text-muted-foreground text-sm">
                                Select an app from the sidebar
                            </div>
                            )}
                    </div>
                </div>

                {/* Close button */}
                <button
                    aria-label="Close DevTools panel"
                    class={cn(
                        "absolute top-2 right-2",
                        "flex items-center justify-center w-7 h-7 rounded-md",
                        "cursor-pointer border-0 bg-transparent transition-colors",
                        "text-foreground/50 hover:text-foreground hover:bg-accent/80",
                    )}
                    onClick={onClose}
                    title="Close panel"
                    type="button"
                >
                    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 14 14" width="12">
                        <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
                    </svg>
                </button>
            </div>
        </>
    );
};

export default DevPanel;
