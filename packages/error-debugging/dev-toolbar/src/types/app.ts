import type { NotificationLevel } from './toolbar.js';

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
  dispatchEvent(event: Event): boolean;
}

/**
 * App view configuration
 */
export type AppView =
  | {
      /**
       * Render app inline in shadow DOM (default)
       */
      type: 'inline';
    }
  | {
      /**
       * Render app in iframe for isolation
       */
      type: 'iframe';
      /**
       * URL to load in iframe
       */
      src: string;
    };

/**
 * Dev toolbar app definition
 */
export interface DevToolbarApp {
  /**
   * Unique identifier for the app
   */
  id: string;

  /**
   * Display name of the app
   */
  name: string;

  /**
   * Icon HTML string (SVG)
   */
  icon: string;

  /**
   * App rendering mode
   */
  view?: AppView;

  /**
   * Initialize the app when opened
   * @param canvas - Shadow root to render into
   * @param eventTarget - Event target for app communication
   * @param helpers - Server helpers (RPC, etc.)
   */
  init?(canvas: ShadowRoot, eventTarget: ToolbarAppEventTarget, helpers: ServerHelpers): void | Promise<void>;

  /**
   * Called before app is toggled off
   * Return false to prevent closing
   * @param canvas - Shadow root of the app
   * @returns Whether to allow closing
   */
  beforeTogglingOff?(canvas: ShadowRoot): boolean | Promise<boolean>;
}

/**
 * Internal app state (extends DevToolbarApp)
 */
export interface DevToolbarAppState extends DevToolbarApp {
  /**
   * Whether this is a built-in app
   */
  builtIn: boolean;

  /**
   * Whether the app is currently active/open
   */
  active: boolean;

  /**
   * App initialization status
   */
  status: 'ready' | 'loading' | 'error';

  /**
   * Notification state
   */
  notification: {
    /**
     * Whether notification is active
     */
    state: boolean;
    /**
     * Notification level
     */
    level?: NotificationLevel;
  };

  /**
   * Event target for this app
   */
  eventTarget: ToolbarAppEventTarget;
}

/**
 * Placeholder for ServerFunctions (defined in rpc.ts)
 */
export interface ServerFunctions {
  [key: string]: (...args: any[]) => Promise<any>;
}
