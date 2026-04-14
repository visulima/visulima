/* eslint-disable max-classes-per-file */
/** @jsxImportSource preact */
import { render } from "preact";

import { setupGlobalHook } from "../hooks/index";
import { getTimelineStore } from "../timeline/index";
import type { DevToolbarApp } from "../types/index";
import { AppManager } from "./app-manager";
import { ToolbarContainer } from "./components/index";
import { createGlobalAPI, setupGlobalAPI } from "./global-api";
import { loadSettings } from "./settings";
import { sharedToolbarStylesheet } from "./stylesheet";

/**
 * Dev Toolbar Web Component.
 */
export class DevToolbar extends HTMLElement {
    private appManager: AppManager;

    private hasBeenInitialized = false;

    private renderRoot: HTMLElement | undefined = undefined;

    public constructor() {
        super();
        // Attach shadow root in constructor (before connectedCallback)
        this.attachShadow({ mode: "open" });
        this.appManager = new AppManager();
    }

    /**
     * Called when element is inserted into the DOM.
     * According to Preact docs, rendering should happen here or after connection.
     */
    public connectedCallback(): void {
        // Enforce singleton — remove self if another instance is already in the DOM
        if (document.querySelectorAll("dev-toolbar").length > 1) {
            console.warn("[dev-toolbar] Only one instance is allowed. Removing duplicate.");
            this.remove();

            return;
        }

        // If init() was called before connection, ensure render happens
        // Otherwise, init() will be called externally and will handle rendering
        if (this.hasBeenInitialized && this.shadowRoot && !this.renderRoot) {
            this.render();
        }
    }

    /**
     * Called when element is removed from the DOM.
     * Cleans up the Preact component to prevent memory leaks.
     */
    public disconnectedCallback(): void {
        // Unmount Preact component when element is removed
        if (this.renderRoot) {
            render(null, this.renderRoot);
            this.renderRoot = undefined;
        }
    }

    /**
     * Initialize the toolbar.
     */
    public init(): void {
        if (this.hasBeenInitialized) {
            return;
        }

        this.hasBeenInitialized = true;

        // Setup global hook
        const hook = setupGlobalHook(
            (app) => {
                this.appManager.registerApp(app);
                this.render();
            },
            (groupId, event) => {
                const timelineStore = getTimelineStore();

                timelineStore.addEvent(groupId, event);
            },
        );

        // Setup global API
        const api = createGlobalAPI(
            {
                clearNotification: (id) => {
                    this.appManager.clearNotification(id);
                    this.render();
                },
                getActiveApp: () => this.appManager.getActiveApp(),
                getApps: () => this.appManager.getAllApps(),
                registerApp: (app) => {
                    this.appManager.registerApp(app);
                    this.render();
                },
                setAppActive: (id, active) => {
                    this.appManager.setAppActive(id, active);
                    this.render();
                },
                setNotification: (id, state, level) => {
                    this.appManager.setNotification(id, state, level);
                    this.render();
                },
                toggleApp: (id) => this.appManager.toggleApp(id),
                unregisterApp: (id) => {
                    this.appManager.unregisterApp(id);
                    this.render();
                },
            },
            {
                hide: () => {
                    this.setToolbarVisible(false);
                },
                show: () => {
                    this.setToolbarVisible(true);
                },
                toggle: () => {
                    const isHidden = this.isHidden();

                    this.setToolbarVisible(!isHidden);
                },
            },
        );

        setupGlobalAPI(api);

        // Emit init event
        hook.emit("devtools:init");

        // Load settings and apply
        const settings = loadSettings();

        // Activate the first app that has defaultOpen: true (if none is already active)
        const defaultApp = this.appManager.getAllApps().find((a) => a.defaultOpen);

        if (defaultApp && !this.appManager.getActiveApp()) {
            this.appManager.openApp(defaultApp.id).catch((error) => {
                console.error(`[dev-toolbar] Failed to auto-open defaultOpen app ${defaultApp.id}:`, error);
            });
        }

        // Render initial UI
        this.render();

        // Setup event listeners
        this.setupEventListeners();

        if (settings.defaultVisible) {
            this.setToolbarVisible(true);
        }
    }

    /**
     * Check if toolbar is hidden.
     */
    public isHidden(): boolean {
        const root = this.shadowRoot!.querySelector<HTMLDivElement>("#__v_dt__root");

        return root?.hasAttribute("data-hidden") ?? true;
    }

    /**
     * Set toolbar visibility.
     */
    public setToolbarVisible(visible: boolean): void {
        // Update the data-hidden attribute directly for immediate feedback

        const root = this.shadowRoot!.querySelector<HTMLDivElement>("#__v_dt__root");

        if (root) {
            if (visible) {
                delete root.dataset.hidden;
            } else {
                root.dataset.hidden = "";
            }
        }

        // Trigger re-render to sync Preact state
        this.render();
    }

    /**
     * Adds an app to the toolbar and triggers a re-render.
     */
    public registerApp(app: DevToolbarApp, builtIn = false): void {
        this.appManager.registerApp(app, builtIn);
        this.render();
    }

    /**
     * Get app manager (for external access).
     */
    public getAppManager(): AppManager {
        return this.appManager;
    }

    /**
     * Renders the toolbar UI using Preact.
     */
    private render(): void {
        const apps = this.appManager.getAllApps();

        // Adopt shared stylesheet for Tailwind CSS

        const shadowRoot = this.shadowRoot!;

        if (sharedToolbarStylesheet) {
            shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
        }

        // Create style element for :host styles
        let styleElement = shadowRoot.querySelector("style");

        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.textContent = `
        :host {
          all: initial;
          /* Cover the full viewport so the host establishes a stacking context
             above vite-overlay (#__v_o__root uses z-[2147483647]). display:contents
             would suppress z-index entirely, so we use position:fixed instead.
             pointer-events:none passes all clicks through to the page;
             interactive toolbar children restore pointer-events:auto. */
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          pointer-events: none;
          overflow: visible;
        }
        @media print {
          :host {
            display: none;
          }
        }
      `;
            shadowRoot.append(styleElement);
        }

        // Create render root if it doesn't exist
        if (!this.renderRoot) {
            this.renderRoot = document.createElement("div");
            shadowRoot.append(this.renderRoot);
        }

        const activeApp = this.appManager.getActiveApp();
        const activeAppId = activeApp?.id;

        // Render Preact component
        render(
            <ToolbarContainer
                activeAppId={activeAppId}
                apps={apps}
                onClearNotification={(appId) => {
                    this.appManager.clearNotification(appId);
                    this.render();
                }}
                onRegisterApp={(_app) => {
                    // App is already registered in AppManager, just trigger render
                    this.render();
                }}
                onSetNotification={(appId, state, level) => {
                    this.appManager.setNotification(appId, state, level);
                    this.render();
                }}
                onToggleApp={async (appId) => {
                    await this.appManager.toggleApp(appId);
                    this.render();
                }}
                onUnregisterApp={(appId) => {
                    this.appManager.unregisterApp(appId);
                    this.render();
                }}
            />,
            this.renderRoot,
        );
    }

    /**
     * Attaches global keyboard shortcuts and other DOM event listeners.
     */
    private setupEventListeners(): void {
        // Keyboard shortcuts
        document.addEventListener("keyup", (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (this.isHidden()) {
                return;
            }

            const activeApp = this.appManager.getActiveApp();

            if (activeApp) {
                this.appManager
                    .toggleApp(activeApp.id)
                    .then(() => {
                        this.render();

                        return undefined;
                    })
                    .catch((error: unknown) => {
                        console.error("[dev-toolbar] Error toggling app:", error);
                    });
            } else {
                this.setToolbarVisible(false);
            }
        });
    }
}

// Export shared stylesheet for use in components

// Register custom elements
if (globalThis.window !== undefined) {
    if (!customElements.get("dev-toolbar")) {
        customElements.define("dev-toolbar", DevToolbar);
    }

    // Register app canvas custom element
    if (!customElements.get("dev-toolbar-app-canvas")) {
        class DevToolbarAppCanvas extends HTMLElement {
            public constructor() {
                super();
                this.attachShadow({ mode: "open" });
            }
        }
        customElements.define("dev-toolbar-app-canvas", DevToolbarAppCanvas);
    }
}

export { sharedToolbarStylesheet } from "./stylesheet";
