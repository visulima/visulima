/* eslint-disable import/exports-last, max-classes-per-file, import/prefer-default-export */
import { setupGlobalHook } from "../hooks/index";
import { getTimelineStore } from "../timeline/index";
import type { DevToolbarApp, DevToolbarAppState, ToolbarPlacement } from "../types/index";
import toolbarStylesRaw from "../ui/styles/main.css" with { type: "css" };
import cn from "../utils/cn";
import { AppManager } from "./app-manager";
import { createGlobalAPI, setupGlobalAPI } from "./global-api";
import { createServerHelpers } from "./helpers";
import { loadSettings } from "./settings";

const HOVER_DELAY = 2000; // 2 seconds
const DEVBAR_HITBOX_ABOVE = 42;

// CSS imports are inlined as strings by packem with mode: "inline"
const toolbarStyles = toolbarStylesRaw as string;

/**
 * Shared stylesheet for all shadow roots.
 * Created once and reused across all shadow roots to avoid CSS duplication.
 */
const createSharedStylesheet = (): CSSStyleSheet | undefined => {
    if (globalThis.window === undefined) {
        return undefined;
    }

    const sheet = new CSSStyleSheet();

    sheet.replaceSync(toolbarStyles);

    return sheet;
};

const sharedToolbarStylesheet = createSharedStylesheet();

/**
 * Dev Toolbar Web Component
 */
export class DevToolbar extends HTMLElement {
    private override shadowRoot: ShadowRoot;

    private appManager: AppManager;

    private delayedHideTimeout: number | undefined;

    private devToolbarContainer: HTMLDivElement | undefined;

    private hasBeenInitialized = false;

    private customAppsToShow = 3;

    public constructor() {
        super();
        this.shadowRoot = this.attachShadow({ mode: "open" });
        this.appManager = new AppManager();
    }

    /**
     * Initialize the toolbar.
     */
    public init(): void {
        if (this.hasBeenInitialized) {
            return;
        }

        this.hasBeenInitialized = true;

        // Register built-in apps (will be imported dynamically)
        // For now, apps are registered externally via the plugin

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

        // Render initial UI
        this.render();

        // Setup event listeners
        this.setupEventListeners();

        // Load settings and apply
        const settings = loadSettings();

        this.setToolbarPlacement(settings.placement);

        if (settings.defaultVisible) {
            this.setToolbarVisible(true);
        }
    }

    /**
     * Check if toolbar is hidden.
     */
    public isHidden(): boolean {
        return this.devToolbarContainer?.hasAttribute("data-hidden") ?? true;
    }

    /**
     * Set toolbar visibility.
     */
    public setToolbarVisible(visible: boolean): void {
        if (visible) {
            this.devToolbarContainer?.removeAttribute("data-hidden");
        } else {
            this.devToolbarContainer?.setAttribute("data-hidden", "");
        }
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
     * Render the toolbar UI
     */
    private render(): void {
        const apps = this.appManager.getAllApps();
        const builtInApps = apps.filter((app) => app.builtIn);
        const customApps = apps.filter((app) => !app.builtIn);
        const visibleApps = [...builtInApps, ...customApps.slice(0, this.customAppsToShow)];
        const overflowApps = customApps.slice(this.customAppsToShow);

        const settings = loadSettings();
        const placement = this.devToolbarContainer?.dataset.placement || settings.placement || "bottom-center";
        const isHidden = this.isHidden();

        // Adopt shared stylesheet for Tailwind CSS
        if (sharedToolbarStylesheet) {
            this.shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
        }

        this.shadowRoot.innerHTML = `
      <style>
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
      </style>
      <div
        id="dev-toolbar-root"
        data-placement="${placement}"
        ${isHidden ? "data-hidden" : ""}
        class="${cn(
            "fixed bottom-0 z-[2000000010] flex flex-col items-center transition-all duration-350 ease-[cubic-bezier(0.485,-0.050,0.285,1.505)] pointer-events-none",
            placement === "bottom-left" && "left-4",
            placement === "bottom-center" && "left-1/2 -translate-x-1/2",
            placement === "bottom-right" && "right-4",
            isHidden && "-bottom-10",
        )}"
      >
        <div
          id="dev-bar-hitbox-above"
          class="w-full pointer-events-auto"
          style="height: ${DEVBAR_HITBOX_ABOVE}px"
        ></div>
        <div
          id="dev-bar"
          class="h-10 overflow-hidden pointer-events-auto border border-[#343841] rounded-lg"
        >
          <div id="bar-container" class="h-full flex">
            ${visibleApps.map((app) => this.getAppTemplate(app)).join("")}
            ${overflowApps.length > 0 ? this.getMoreAppTemplate() : ""}
          </div>
        </div>
        <div id="dev-bar-hitbox-below" class="w-full h-4 pointer-events-auto"></div>
      </div>
      ${apps.map((app) => this.getAppCanvasTemplate(app)).join("")}
    `;

        this.devToolbarContainer = this.shadowRoot.querySelector<HTMLDivElement>("#dev-toolbar-root")!;

        // Setup app button click handlers and canvases
        for (const app of apps) {
            const button = this.shadowRoot.querySelector(`[data-app-id="${app.id}"]`);

            if (button) {
                button.addEventListener("click", () => {
                    this.appManager.toggleApp(app.id).then(() => {
                        this.render();
                    });
                });
            }

            // Setup app canvas reference - the custom element already has a shadow root
            const canvas = this.shadowRoot.querySelector(`dev-toolbar-app-canvas[data-app-id="${app.id}"]`) as HTMLElement | null;

            if (canvas && canvas.shadowRoot) {
                // Store shadow root reference for app initialization
                this.appManager.setAppCanvas(app.id, { element: canvas, shadowRoot: canvas.shadowRoot });

                // Initialize app if it's active
                // Note: We must reinitialize on every render since innerHTML destroys previous content
                if (app.active) {
                    this.initializeApp(app.id, canvas.shadowRoot);
                }
            }
        }
    }

    /**
     * Initialize an app's content in its canvas.
     */
    private async initializeApp(appId: string, shadowRoot: ShadowRoot): Promise<void> {
        const app = this.appManager.getApp(appId);

        if (!app || !app.init) {
            return;
        }

        try {
            // Clear previous content (since render() recreates elements)
            shadowRoot.innerHTML = "";

            // Adopt shared stylesheet for Tailwind CSS
            if (sharedToolbarStylesheet) {
                shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
            }

            const helpers = createServerHelpers();

            await app.init(shadowRoot, app.eventTarget, helpers);
            this.appManager.markAppInitialized(appId);
        } catch (error) {
            console.error(`[dev-toolbar] Failed to init app ${appId}:`, error);
        }
    }

    /**
     * Get app button template
     */
    // eslint-disable-next-line class-methods-use-this
    private getAppTemplate(app: DevToolbarAppState): string {
        const notificationBadge = app.notification.state
            ? `<span class="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ${app.notification.state ? "block" : "hidden"}" data-level="${app.notification.level || "info"}"></span>`
            : "";

        return `
      <button
        class="${cn(
            "flex justify-center items-center w-11 border-0 bg-transparent text-white font-sans text-base leading-tight whitespace-nowrap no-underline p-0 m-0 overflow-hidden transition-opacity duration-200 ease-out cursor-pointer",
            "hover:bg-white/12.5 focus-visible:bg-white/12.5 focus-visible:-outline-offset-3",
            app.active && "bg-[rgba(71,78,94,1)]",
        )}"
        data-app-id="${app.id}"
      >
        <div class="relative max-w-5 max-h-5 select-none">
          <div class="w-5 h-5 block m-auto">${app.icon}</div>
          ${notificationBadge}
        </div>
      </button>
    `;
    }

    /**
     * Get "more apps" button template
     */
    // eslint-disable-next-line class-methods-use-this
    private getMoreAppTemplate(): string {
        return `
      <button
        class="flex justify-center items-center w-11 border-0 bg-transparent text-white font-sans text-base leading-tight whitespace-nowrap no-underline p-0 m-0 overflow-hidden transition-opacity duration-200 ease-out cursor-pointer hover:bg-white/12.5 focus-visible:bg-white/12.5 focus-visible:-outline-offset-3"
        data-app-id="dev-toolbar:more"
      >
        <div class="relative max-w-5 max-h-5 select-none">⋯</div>
      </button>
    `;
    }

    /**
     * Get app canvas template.
     */
    // eslint-disable-next-line class-methods-use-this
    private getAppCanvasTemplate(app: DevToolbarAppState): string {
        return `
      <dev-toolbar-app-canvas
        data-app-id="${app.id}"
        class="${cn(
            "fixed bottom-[60px] left-1/2 -translate-x-1/2 z-[2000000009] bg-[rgba(19,21,26,0.95)] border border-[#343841] rounded-lg p-4 min-w-[300px] max-w-[600px] max-h-[400px] overflow-auto",
            app.active ? "block" : "hidden",
        )}"
      ></dev-toolbar-app-canvas>
    `;
    }

    /**
     * Setup event listeners.
     */
    private setupEventListeners(): void {
        // Auto-hide on mouse leave
        if (this.devToolbarContainer) {
            this.devToolbarContainer.addEventListener("mouseenter", () => {
                this.clearDelayedHide();
            });

            this.devToolbarContainer.addEventListener("mouseleave", () => {
                if (!this.appManager.getActiveApp() && !this.isHidden()) {
                    this.triggerDelayedHide();
                }
            });
        }

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

    /**
     * Set toolbar placement.
     */
    private setToolbarPlacement(placement: ToolbarPlacement): void {
        this.devToolbarContainer?.setAttribute("data-placement", placement);
    }

    /**
     * Clear delayed hide timeout
     */
    private clearDelayedHide(): void {
        if (this.delayedHideTimeout !== undefined) {
            globalThis.clearTimeout(this.delayedHideTimeout);
            this.delayedHideTimeout = undefined;
        }
    }

    /**
     * Trigger delayed hide.
     */
    private triggerDelayedHide(): void {
        this.clearDelayedHide();
        this.delayedHideTimeout = globalThis.setTimeout(() => {
            this.setToolbarVisible(false);
            this.delayedHideTimeout = undefined;
        }, HOVER_DELAY);
    }
}

// Register custom elements
if (globalThis.window !== undefined) {
    if (!customElements.get("dev-toolbar")) {
        customElements.define("dev-toolbar", DevToolbar);
    }

    // Register app canvas custom element
    if (!customElements.get("dev-toolbar-app-canvas")) {
        class DevToolbarAppCanvas extends HTMLElement {
            shadowRoot: ShadowRoot;

            constructor() {
                super();
                this.shadowRoot = this.attachShadow({ mode: "open" });
            }
        }
        customElements.define("dev-toolbar-app-canvas", DevToolbarAppCanvas);
    }
}
