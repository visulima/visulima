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
 * Panel inset-position classes based on toolbar side.
 * The panel fills the remaining screen space on the opposite side of the toolbar.
 */
const getPanelPositionClasses = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom": {
            return "bottom-12 left-4 right-4 top-4";
        }

        case "left": {
            return "left-12 top-4 bottom-4 right-4";
        }

        case "right": {
            return "right-12 top-4 bottom-4 left-4";
        }

        case "top": {
            return "top-12 left-4 right-4 bottom-4";
        }

        default: {
            return "bottom-12 left-4 right-4 top-4";
        }
    }
};

/**
 * Returns the Tailwind transform-origin class for direction-aware entrance animation.
 * e.g. toolbar at bottom → panel scales from below → origin-[bottom_center]
 */
const getOriginClass = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom": {
            return "origin-[bottom_center]";
        }

        case "left": {
            return "origin-[left_center]";
        }

        case "right": {
            return "origin-[right_center]";
        }

        case "top": {
            return "origin-[top_center]";
        }

        default: {
            return "origin-[bottom_center]";
        }
    }
};

/**
 * Returns visibility + entrance-direction transform classes.
 * When hidden: slides 8px toward the toolbar + scales down slightly.
 */
const getVisibilityClasses = (position: DevPanelProps["position"], isVisible: boolean): string => {
    if (isVisible) {
        return "opacity-100 scale-100";
    }

    const directionTranslate: Record<string, string> = {
        bottom: "translate-y-2",
        left: "-translate-x-2",
        right: "translate-x-2",
        top: "-translate-y-2",
    };

    return cn("opacity-0 pointer-events-none scale-[0.99]", directionTranslate[position] ?? "translate-y-2");
};

/**
 * Returns max-dimension constraint classes based on toolbar position.
 */
const getConstraintClasses = (position: DevPanelProps["position"]): string => {
    if (position === "left" || position === "right") {
        return "max-w-[calc(100vw-80px)] max-h-[calc(100vh-32px)]";
    }

    return "max-h-[calc(100vh-72px)]";
};

/**
 * Unified DevTools panel — sidebar navigation + content area.
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
    // Two-phase mount: isRendered keeps DOM alive during exit animation;
    // isVisible drives the CSS transition class.
    const [isRendered, setIsRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (panelVisible) {
            setIsRendered(true);
            // Paint the hidden state first (one frame), then transition to visible
            const timerId = setTimeout(() => setIsVisible(true), 16);

            return () => clearTimeout(timerId);
        }

        // Start exit transition, then unmount after it completes
        setIsVisible(false);
        const timer = setTimeout(() => setIsRendered(false), 220);

        return () => clearTimeout(timer);
    }, [panelVisible]);

    // Escape key closes the panel
    useEffect(() => {
        if (!panelVisible) {
            return undefined;
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

    if (!isRendered) {
        return null;
    }

    return (
        <>
            {/* Backdrop — clicking outside closes the panel */}
            <div
                aria-hidden="true"
                class={cn(
                    "fixed inset-0 z-[2000000008]",
                    "transition-opacity duration-200",
                    isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
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
                    getPanelPositionClasses(position),
                    getConstraintClasses(position),
                    // Panel chrome
                    "bg-background border border-border rounded-2xl overflow-hidden",
                    "shadow-[var(--panel-shadow)]",
                    // Animation
                    "transition-[var(--panel-transition)]",
                    getOriginClass(position),
                    getVisibilityClasses(position, isVisible),
                    "flex flex-row",
                )}
                role="dialog"
            >
                {/* Left sidebar — collapsible icon/label navigation */}
                <nav
                    aria-label="DevTools apps"
                    class={cn(
                        "flex flex-col flex-shrink-0",
                        "transition-[width] duration-200 ease-out",
                        "bg-muted/40 dark:bg-muted/20",
                        sidebarCollapsed ? "w-12" : "w-40",
                    )}
                >
                    {/* App buttons */}
                    <div class="flex flex-col gap-0.5 flex-1 py-2 px-1.5">
                        {apps.map((app) => (
                            <div class="relative group/nav-item" key={app.id}>
                                <button
                                    aria-label={app.name}
                                    aria-pressed={activeAppId === app.id}
                                    class={cn(
                                                        "relative flex items-center w-full h-9 rounded-lg",
                                        "border-0 cursor-pointer",
                                        "transition-[background,color,opacity,transform] duration-150",
                                        "active:scale-[0.97]",
                                        sidebarCollapsed ? "justify-center" : "gap-2.5 px-2.5",
                                        activeAppId === app.id
                                            ? "bg-primary/[0.08] text-primary opacity-100"
                                            : "bg-transparent text-muted-foreground opacity-60 hover:bg-foreground/[0.05] hover:text-foreground hover:opacity-90",
                                    )}
                                    onClick={() => {
                                        if (app.id === activeAppId) {
                                            return;
                                        }

                                        onToggleApp(app.id).catch(console.error);
                                    }}
                                    type="button"
                                >
                                    {/* Icon */}
                                    {app.icon ? (
                                        <span
                                            class="w-4 h-4 flex-shrink-0 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4"
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML={{ __html: app.icon }}
                                        />
                                    ) : (
                                        <span class="w-4 h-4 flex-shrink-0 flex items-center justify-center text-[0.625rem] font-bold uppercase select-none">
                                            {app.name.slice(0, 2)}
                                        </span>
                                    )}

                                    {/* Label — visible only when expanded */}
                                    {!sidebarCollapsed && (
                                        <span class="text-xs font-medium truncate leading-none">
                                            {app.name}
                                        </span>
                                    )}
                                </button>

                                {/* Notification badge */}
                                {app.notification.state && (
                                    <span
                                        aria-hidden="true"
                                        class={cn(
                                            "pointer-events-none absolute top-0.5 rounded-full ring-1 ring-background",
                                            sidebarCollapsed ? "right-0.5" : "right-2",
                                            "w-1.5 h-1.5",
                                            app.notification.level === "error"
                                                ? "bg-destructive"
                                                : app.notification.level === "warning"
                                                    ? "bg-warning"
                                                    : "bg-info",
                                        )}
                                    />
                                )}

                                {/* Tooltip — shown only in collapsed mode */}
                                {sidebarCollapsed && (
                                    <div
                                        class={cn(
                                            "absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2",
                                            "pointer-events-none z-50 whitespace-nowrap",
                                            "opacity-0 -translate-x-1 group-hover/nav-item:opacity-100 group-hover/nav-item:translate-x-0",
                                            "transition-[opacity,transform] duration-[140ms] ease-out",
                                        )}
                                    >
                                        <div class="text-[0.6875rem] font-medium font-sans bg-background text-foreground px-2.5 py-1 rounded-full border border-border shadow-md">
                                            {app.name}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Collapse / expand toggle */}
                    <div class="border-t border-border/50 px-1.5 py-1.5">
                        <button
                            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            class={cn(
                                "flex items-center h-7 w-full rounded-lg",
                                "border-0 cursor-pointer bg-transparent",
                                "text-muted-foreground/35 hover:text-muted-foreground hover:bg-foreground/[0.05]",
                                "transition-[background,color] duration-150",
                                sidebarCollapsed ? "justify-center" : "gap-1.5 px-2",
                            )}
                            onClick={() => setSidebarCollapsed((c) => !c)}
                            type="button"
                        >
                            <svg
                                aria-hidden="true"
                                class={cn(
                                    "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ease-out",
                                    !sidebarCollapsed && "rotate-180",
                                )}
                                fill="none"
                                viewBox="0 0 14 14"
                            >
                                <path
                                    d="M5 2.5L9.5 7L5 11.5"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="1.5"
                                />
                            </svg>
                            {!sidebarCollapsed && (
                                <span class="text-[0.6875rem]">Collapse</span>
                            )}
                        </button>
                    </div>
                </nav>

                {/* Sidebar / content divider */}
                <div aria-orientation="vertical" class="w-px flex-shrink-0 bg-border self-stretch" role="separator" />

                {/* Content area */}
                <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Header — app name + close button */}
                    <div class="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border flex-shrink-0 bg-background">
                        <div class="flex items-center gap-2 min-w-0">
                            {activeApp?.icon && (
                                <span
                                    class="w-4 h-4 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4 flex-shrink-0 text-primary/70"
                                    // eslint-disable-next-line react/no-danger
                                    dangerouslySetInnerHTML={{ __html: activeApp.icon }}
                                />
                            )}
                            <span class="font-sans text-[0.8125rem] font-medium text-foreground truncate">
                                {activeApp?.name ?? "DevTools"}
                            </span>
                        </div>

                        <button
                            aria-label="Close DevTools panel"
                            class={cn(
                                "flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0",
                                "cursor-pointer border-0 bg-transparent",
                                "text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06]",
                                "transition-[background,color,transform] duration-[120ms]",
                                "active:scale-90",
                            )}
                            onClick={onClose}
                            title="Close (Esc)"
                            type="button"
                        >
                            <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 14 14" width="10">
                                <path
                                    d="M1 1L13 13M13 1L1 13"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-width="2.5"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Scrollable app content — class kept for ::-webkit-scrollbar targeting */}
                    <div class="devtools-content-scroll [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] flex-1 overflow-auto min-h-0">
                        {activeApp ? (
                            <AppContent app={activeApp} key={activeApp.id} />
                        ) : (
                            <div class="flex flex-col items-center justify-center min-h-48 h-full gap-2">
                                <div class="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center">
                                    <svg
                                        class="text-muted-foreground/50"
                                        fill="none"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        width="16"
                                    >
                                        <path
                                            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                            stroke="currentColor"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="1.5"
                                        />
                                    </svg>
                                </div>
                                <span class="text-xs text-muted-foreground/60">Select an app</span>
                            </div>
                        )}
                    </div>

                    {/* Footer — keyboard hint */}
                    <div class="flex items-center gap-1.5 px-3 py-1 border-t border-border flex-shrink-0">
                        <kbd class="font-mono text-[0.625rem] bg-background border border-border border-b-2 rounded px-1.5 leading-[1.125rem] text-foreground/50 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-accent dark:shadow-[0_1px_0_rgba(0,0,0,0.25)]">
                            Esc
                        </kbd>
                        <span class="text-[0.6875rem] text-muted-foreground/45">to close</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DevPanel;
