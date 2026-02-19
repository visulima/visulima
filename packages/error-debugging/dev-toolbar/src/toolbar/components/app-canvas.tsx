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
                    "bg-background border border-border rounded-[10px]",
                    "shadow-[var(--panel-shadow)]",
                    // Animation
                    "transition-[var(--panel-transition)]",
                    getOriginClass(position),
                    getVisibilityClasses(position, isVisible),
                    "flex flex-row",
                )}
                role="dialog"
            >
                {/* Left sidebar — icon navigation */}
                <nav
                    aria-label="DevTools apps"
                    class="flex flex-col w-[52px] flex-shrink-0 py-2 overflow-y-auto bg-muted dark:bg-[oklch(10%_0.015_264)]"
                >
                    <div class="flex flex-col items-center gap-1 px-1.5">
                        {apps.map((app) => (
                            <div class="relative w-full" key={app.id}>
                                <button
                                    aria-label={app.name}
                                    aria-pressed={activeAppId === app.id}
                                    class={cn(
                                        "relative flex items-center justify-center w-full h-9 rounded-md",
                                        "border-0 cursor-pointer",
                                        "transition-[background,color,opacity,transform] duration-150",
                                        "active:scale-[0.93]",
                                        activeAppId === app.id
                                            ? "bg-[oklch(13%_0.01_264)] text-[oklch(98%_0_0)] opacity-100 dark:bg-[oklch(30%_0.02_264)] dark:text-[oklch(94%_0.01_264)]"
                                            : "bg-transparent text-muted-foreground opacity-60 hover:bg-black/5 hover:text-foreground hover:opacity-90 dark:hover:bg-white/[0.07]",
                                    )}
                                    onClick={() => {
                                        // Clicking the already-active app does nothing
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
                                            class="w-[18px] h-[18px] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]"
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML={{ __html: app.icon }}
                                        />
                                    ) : (
                                        <span class="text-xs font-semibold uppercase select-none">
                                            {app.name.slice(0, 2)}
                                        </span>
                                    )}
                                </button>

                                {/* Notification badge */}
                                {app.notification.state && (
                                    <span
                                        aria-hidden="true"
                                        class={cn(
                                            "pointer-events-none absolute top-0.5 right-0.5",
                                            "w-[7px] h-[7px] rounded-full ring-[1.5px] ring-background",
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

                {/* Sidebar / content divider */}
                <div aria-orientation="vertical" class="w-px flex-shrink-0 bg-border self-stretch" role="separator" />

                {/* Content area */}
                <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Header — app name + close button */}
                    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border flex-shrink-0 bg-background">
                        <div class="flex items-center gap-2 min-w-0">
                            {activeApp?.icon && (
                                <span
                                    class="w-4 h-4 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4 flex-shrink-0 text-muted-foreground/70"
                                    // eslint-disable-next-line react/no-danger
                                    dangerouslySetInnerHTML={{ __html: activeApp.icon }}
                                />
                            )}
                            <span class="font-sans text-[13px] font-medium text-foreground truncate">
                                {activeApp?.name ?? "DevTools"}
                            </span>
                        </div>

                        <button
                            aria-label="Close DevTools panel"
                            class={cn(
                                "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                                "cursor-pointer border-0 bg-transparent",
                                "text-foreground/50 hover:text-foreground hover:bg-accent/80",
                                "transition-[background,color,transform] duration-[120ms]",
                                "hover:scale-110 active:scale-90",
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
                            <div class="flex flex-col items-center justify-center min-h-[200px] h-full gap-3">
                                <svg
                                    class="text-muted-foreground opacity-25"
                                    fill="none"
                                    height="32"
                                    viewBox="0 0 24 24"
                                    width="32"
                                >
                                    <path
                                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                        stroke="currentColor"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="1.5"
                                    />
                                </svg>
                                <span class="text-sm text-muted-foreground">Select an app from the sidebar</span>
                            </div>
                        )}
                    </div>

                    {/* Footer — keyboard hint + branding */}
                    <div class="flex items-center justify-between px-3 py-1.5 border-t border-border flex-shrink-0 bg-muted dark:bg-[oklch(10%_0.015_264)]">
                        <div class="flex items-center gap-1 text-[11px] text-muted-foreground/55">
                            <kbd class="font-mono text-[10px] bg-background border border-border border-b-2 rounded px-[5px] leading-[18px] text-foreground shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-accent dark:shadow-[0_1px_0_rgba(0,0,0,0.25)]">
                                Esc
                            </kbd>
                            <span>close</span>
                        </div>
                        <span class="text-[10px] tracking-[0.08em] uppercase font-medium text-muted-foreground/35">Visulima</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DevPanel;
