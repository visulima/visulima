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
     * Icon HTML string (SVG)
     */
    icon: string;

    /**
     * Unique identifier for the app
     */
    id: string;

    /**
     * Initialize the app when opened
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
