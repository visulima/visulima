import type { ComponentType } from "preact";

import type { NotificationLevel } from "./toolbar";

/**
 * Server helpers available to apps
 */
export interface ServerHelpers {
    /**
     * RPC client for calling server functions
     */
    rpc: {
        [K in keyof ServerFunctions]: ServerFunctions[K];
    };
}

/**
 * Props passed to app tooltip (hover mini-canvas) components.
 * Keep compact — tooltip components should be lightweight.
 */
export interface AppTooltipProps {
    /**
     * Server helpers (RPC, etc.)
     */
    helpers: ServerHelpers;
}

/**
 * Event target for app communication
 */
export interface ToolbarAppEventTarget extends EventTarget {
    /**
     * Dispatch a custom event
     */
    dispatchEvent: (event: Event) => boolean;
}

/**
 * App view configuration
 */
export type AppView
    = | {
        /**
         * Render app inline in shadow DOM (default)
         */
        type: "inline";
    }
    | {
        /**
         * URL to load in iframe
         */
        src: string;

        /**
         * Render app in iframe for isolation
         */
        type: "iframe";
    };

/**
 * Props passed to Preact component apps
 */
export interface AppComponentProps {
    /**
     * Event target for app communication
     */
    eventTarget: ToolbarAppEventTarget;

    /**
     * Server helpers (RPC, etc.)
     */
    helpers: ServerHelpers;
}

/**
 * Dev toolbar app definition
 */
export interface DevToolbarApp {
    /**
     * Called before app is toggled off
     * Return false to prevent closing
     * @param canvas Shadow root of the app
     * @returns Whether to allow closing
     */
    beforeTogglingOff?: (canvas: ShadowRoot) => boolean | Promise<boolean>;

    /**
     * Preact component for rendering (alternative to init)
     * If provided, this will be used instead of init
     */
    component?: ComponentType<AppComponentProps>;

    /**
     * When true, this app is automatically activated when the toolbar opens for
     * the first time (or when no other app has been activated yet).
     * Only the first registered app with defaultOpen: true is used.
     * @default false
     */
    defaultOpen?: boolean;

    /**
     * Called when the app is unregistered / removed from the toolbar.
     * Use this for final cleanup (event listeners, timers, subscriptions).
     * @param canvas Shadow root of the app
     */
    destroy?: (canvas: ShadowRoot) => Promise<void> | void;

    /**
     * Icon HTML string (SVG)
     */
    icon: string;

    /**
     * Unique identifier for the app
     */
    id: string;

    /**
     * Initialize the app when opened (vanilla JS/CSS/HTML)
     * @param canvas Shadow root to render into
     * @param eventTarget Event target for app communication
     * @param helpers Server helpers (RPC, etc.)
     */
    init?: (canvas: ShadowRoot, eventTarget: ToolbarAppEventTarget, helpers: ServerHelpers) => void | Promise<void>;

    /**
     * Display name of the app
     */
    name: string;

    /**
     * Action button callback — called when the button is activated (active: false → true).
     * When present, clicking the toolbar button will NOT open a panel.
     * Instead the button toggles its active state and calls onClick (activate)
     * or onDeactivate (deactivate).
     */
    onClick?: () => Promise<void> | void;

    /**
     * Called when the action button is deactivated (active: true → false).
     * Only meaningful when onClick is also provided.
     */
    onDeactivate?: () => Promise<void> | void;

    /**
     * Optional hover tooltip component — renders a compact live preview when the
     * user hovers over this app's button in the toolbar pill.
     * The component should be small (≤280px wide) and self-contained.
     * If omitted, hovering shows the native title tooltip only.
     */
    tooltip?: ComponentType<AppTooltipProps>;

    /**
     * App rendering mode
     */
    view?: AppView;
}

/**
 * Internal app state (extends DevToolbarApp)
 */
export interface DevToolbarAppState extends DevToolbarApp {
    /**
     * Whether the app is currently active/open
     */
    active: boolean;

    /**
     * Whether this is a built-in app
     */
    builtIn: boolean;

    /**
     * Event target for this app
     */
    eventTarget: ToolbarAppEventTarget;

    /**
     * Notification state
     */
    notification: {
        /**
         * Notification level
         */
        level?: NotificationLevel;

        /**
         * Whether notification is active
         */
        state: boolean;
    };

    /**
     * App initialization status
     */
    status: "ready" | "loading" | "pending" | "error";
}

/**
 * Placeholder for ServerFunctions (defined in rpc.ts)
 */
export interface ServerFunctions {
    [key: string]: (...args: any[]) => Promise<any>;
}
