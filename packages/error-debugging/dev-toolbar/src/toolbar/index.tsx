/* eslint-disable import/exports-last, max-classes-per-file, import/prefer-default-export */
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
 * Dev Toolbar Web Component
 */
export class DevToolbar extends HTMLElement {
    private appManager: AppManager;

    private hasBeenInitialized = false;

    private customAppsToShow = 3;

    private renderRoot: HTMLElement | null = null;

    public constructor() {
        super();
        // Attach shadow root in constructor (before connectedCallback)
        this.attachShadow({ mode: "open" });
        this.appManager = new AppManager();
    }

    /**
     * Called when element is inserted into the DOM
     * According to Preact docs, rendering should happen here or after connection
     */
    public connectedCallback(): void {
        // If init() was called before connection, ensure render happens
        // Otherwise, init() will be called externally and will handle rendering
        if (this.hasBeenInitialized && this.shadowRoot && !this.renderRoot) {
            this.render();
        }
    }

    /**
     * Called when element is removed from the DOM
     * Clean up Preact component to prevent memory leaks
     */
    public disconnectedCallback(): void {
        // Unmount Preact component when element is removed
        if (this.renderRoot) {
            render(null, this.renderRoot);
            this.renderRoot = null;
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
                hide: () => this.setToolbarVisible(false),
                show: () => this.setToolbarVisible(true),
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
        const root = this.shadowRoot.querySelector<HTMLDivElement>("#dev-toolbar-root");

        return root?.hasAttribute("data-hidden") ?? true;
    }

    /**
     * Set toolbar visibility.
     */
    public setToolbarVisible(visible: boolean): void {
        // Update the data-hidden attribute directly for immediate feedback
        const root = this.shadowRoot.querySelector<HTMLDivElement>("#dev-toolbar-root");

        if (root) {
            if (visible) {
                root.removeAttribute("data-hidden");
            } else {
                root.setAttribute("data-hidden", "");
            }
        }

        // Trigger re-render to sync Preact state
        this.render();
    }

    /**
     * Register an app.
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
     * Render the toolbar UI using Preact
     */
    private render(): void {
        const apps = this.appManager.getAllApps();
        const isVisible = !this.isHidden();

        // Adopt shared stylesheet for Tailwind CSS
        if (sharedToolbarStylesheet) {
            this.shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
        }

        // Create style element for :host styles
        let styleElement = this.shadowRoot.querySelector("style");

        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.textContent = `
        :host {
          all: initial;
          z-index: 999999;
          display: contents;
        }
        @media print {
          :host {
            display: none;
          }
        }
      `;
            this.shadowRoot.appendChild(styleElement);
        }

        // Create render root if it doesn't exist
        if (!this.renderRoot) {
            this.renderRoot = document.createElement("div");
            this.shadowRoot.appendChild(this.renderRoot);
        }

        const activeApp = this.appManager.getActiveApp();
        const activeAppId = activeApp?.id || null;

        // Render Preact component
        render(
            <ToolbarContainer
                activeAppId={activeAppId}
                apps={apps}
                customAppsToShow={this.customAppsToShow}
                initialVisible={isVisible}
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
     * Setup event listeners.
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
                this.appManager.toggleApp(activeApp.id).then(() => {
                    this.render();
                });
            } else {
                this.setToolbarVisible(false);
            }
        });
    }
}

// Export shared stylesheet for use in components
export { sharedToolbarStylesheet };

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
