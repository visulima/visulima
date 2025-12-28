import type { DevToolbarApp, DevToolbarAppState, ToolbarPlacement } from '../types/index.js';
import { AppManager } from './app-manager.js';
import { loadSettings, updateSettings } from './settings.js';
import { createGlobalAPI, setupGlobalAPI } from './global-api.js';
import { setupGlobalHook } from '../hooks/index.js';
import { getTimelineStore } from '../timeline/index.js';

const HOVER_DELAY = 2000; // 2 seconds
const DEVBAR_HITBOX_ABOVE = 42;

/**
 * Dev Toolbar Web Component
 */
export class DevToolbar extends HTMLElement {
  private shadowRoot: ShadowRoot;
  private appManager: AppManager;
  private delayedHideTimeout: number | undefined;
  private devToolbarContainer: HTMLDivElement | undefined;
  private hasBeenInitialized = false;
  private customAppsToShow = 3;

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
    this.appManager = new AppManager();
  }

  /**
   * Initialize the toolbar
   */
  init(): void {
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
        getApps: () => this.appManager.getAllApps(),
        getActiveApp: () => this.appManager.getActiveApp(),
        toggleApp: (id) => this.appManager.toggleApp(id),
        registerApp: (app) => {
          this.appManager.registerApp(app);
          this.render();
        },
        unregisterApp: (id) => {
          this.appManager.unregisterApp(id);
          this.render();
        },
        setNotification: (id, state, level) => {
          this.appManager.setNotification(id, state, level);
          this.render();
        },
        clearNotification: (id) => {
          this.appManager.clearNotification(id);
          this.render();
        },
      },
      {
        show: () => this.setToolbarVisible(true),
        hide: () => this.setToolbarVisible(false),
        toggle: () => {
          const isHidden = this.isHidden();
          this.setToolbarVisible(!isHidden);
        },
      },
    );

    setupGlobalAPI(api);

    // Emit init event
    hook.emit('devtools:init');

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
   * Render the toolbar UI
   */
  private render(): void {
    const apps = this.appManager.getAllApps();
    const builtInApps = apps.filter((app) => app.builtIn);
    const customApps = apps.filter((app) => !app.builtIn);
    const visibleApps = [...builtInApps, ...customApps.slice(0, this.customAppsToShow)];
    const overflowApps = customApps.slice(this.customAppsToShow);

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

        #dev-toolbar-root {
          position: fixed;
          bottom: 0px;
          z-index: 2000000010;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: bottom 0.35s cubic-bezier(0.485, -0.050, 0.285, 1.505);
          pointer-events: none;
        }

        #dev-toolbar-root[data-hidden] {
          bottom: -40px;
        }

        #dev-toolbar-root[data-placement="bottom-left"] {
          left: 16px;
        }
        #dev-toolbar-root[data-placement="bottom-center"] {
          left: 50%;
          transform: translateX(-50%);
        }
        #dev-toolbar-root[data-placement="bottom-right"] {
          right: 16px;
        }

        #dev-bar-hitbox-above,
        #dev-bar-hitbox-below {
          width: 100%;
          pointer-events: auto;
        }
        #dev-bar-hitbox-above {
          height: ${DEVBAR_HITBOX_ABOVE}px;
        }
        #dev-bar-hitbox-below {
          height: 16px;
        }

        #dev-bar {
          height: 40px;
          overflow: hidden;
          pointer-events: auto;
          background: linear-gradient(180deg, #13151A 0%, rgba(19, 21, 26, 0.88) 100%);
          border: 1px solid #343841;
          border-radius: 9999px;
          box-shadow: 0px 0px 0px 0px rgba(19, 21, 26, 0.30), 0px 1px 2px 0px rgba(19, 21, 26, 0.29), 0px 4px 4px 0px rgba(19, 21, 26, 0.26), 0px 10px 6px 0px rgba(19, 21, 26, 0.15), 0px 17px 7px 0px rgba(19, 21, 26, 0.04), 0px 26px 7px 0px rgba(19, 21, 26, 0.01);
        }

        #dev-bar .item {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 44px;
          border: 0;
          background: transparent;
          color: white;
          font-family: system-ui, sans-serif;
          font-size: 1rem;
          line-height: 1.2;
          white-space: nowrap;
          text-decoration: none;
          padding: 0;
          margin: 0;
          overflow: hidden;
          transition: opacity 0.2s ease-out 0s;
          cursor: pointer;
        }

        #dev-bar .item:hover,
        #dev-bar .item:focus-visible {
          background: rgba(255, 255, 255, 0.125);
          outline-offset: -3px;
        }

        #dev-bar .item.active {
          background: rgba(71, 78, 94, 1);
        }

        #dev-bar .item .icon {
          position: relative;
          max-width: 20px;
          max-height: 20px;
          user-select: none;
        }

        #dev-bar .item .icon > svg {
          width: 20px;
          height: 20px;
          display: block;
          margin: auto;
        }

        #dev-bar .item .notification {
          display: none;
          position: absolute;
          top: -4px;
          right: -6px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #EF4444;
        }

        #dev-bar .item .notification[data-active] {
          display: block;
        }

        #dev-bar #bar-container {
          height: 100%;
          display: flex;
        }
      </style>
      <div id="dev-toolbar-root" data-placement="bottom-center">
        <div id="dev-bar-hitbox-above"></div>
        <div id="dev-bar">
          <div id="bar-container">
            ${visibleApps.map((app) => this.getAppTemplate(app)).join('')}
            ${overflowApps.length > 0 ? this.getMoreAppTemplate() : ''}
          </div>
        </div>
        <div id="dev-bar-hitbox-below"></div>
      </div>
      ${apps.map((app) => this.getAppCanvasTemplate(app)).join('')}
    `;

    this.devToolbarContainer = this.shadowRoot.querySelector<HTMLDivElement>('#dev-toolbar-root')!;

    // Setup app button click handlers
    for (const app of apps) {
      const button = this.shadowRoot.querySelector(`[data-app-id="${app.id}"]`);
      if (button) {
        button.addEventListener('click', () => {
          this.appManager.toggleApp(app.id).then(() => {
            this.render();
          });
        });
      }

      // Setup app canvas with shadow root
      const canvas = this.shadowRoot.querySelector(`dev-toolbar-app-canvas[data-app-id="${app.id}"]`);
      if (canvas && !(canvas as any).shadowRoot) {
        const shadowRoot = (canvas as HTMLElement).attachShadow({ mode: 'open' });
        // Store shadow root reference for app initialization
        (this.appManager as any).setAppCanvas(app.id, { shadowRoot, element: canvas });
      }
    }
  }

  /**
   * Get app button template
   */
  private getAppTemplate(app: DevToolbarAppState): string {
    const activeClass = app.active ? 'active' : '';
    const notificationBadge = app.notification.state
      ? `<span class="notification" data-active data-level="${app.notification.level || 'info'}"></span>`
      : '';

    return `
      <button class="item ${activeClass}" data-app-id="${app.id}">
        <div class="icon">
          ${app.icon}
          ${notificationBadge}
        </div>
      </button>
    `;
  }

  /**
   * Get "more apps" button template
   */
  private getMoreAppTemplate(): string {
    return `
      <button class="item" data-app-id="dev-toolbar:more">
        <div class="icon">⋯</div>
      </button>
    `;
  }

  /**
   * Get app canvas template
   */
  private getAppCanvasTemplate(app: DevToolbarAppState): string {
    const displayStyle = app.active ? 'block' : 'none';
    // Create shadow DOM for app isolation
    return `
      <dev-toolbar-app-canvas data-app-id="${app.id}" style="display: ${displayStyle}; position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%); z-index: 2000000009; background: rgba(19, 21, 26, 0.95); border: 1px solid #343841; border-radius: 8px; padding: 16px; min-width: 300px; max-width: 600px; max-height: 400px; overflow: auto;"></dev-toolbar-app-canvas>
    `;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Auto-hide on mouse leave
    if (this.devToolbarContainer) {
      this.devToolbarContainer.addEventListener('mouseenter', () => {
        this.clearDelayedHide();
      });

      this.devToolbarContainer.addEventListener('mouseleave', () => {
        if (!this.appManager.getActiveApp() && !this.isHidden()) {
          this.triggerDelayedHide();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keyup', (event) => {
      if (event.key !== 'Escape') {
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
   * Check if toolbar is hidden
   */
  isHidden(): boolean {
    return this.devToolbarContainer?.hasAttribute('data-hidden') ?? true;
  }

  /**
   * Set toolbar visibility
   */
  setToolbarVisible(visible: boolean): void {
    if (visible) {
      this.devToolbarContainer?.removeAttribute('data-hidden');
    } else {
      this.devToolbarContainer?.setAttribute('data-hidden', '');
    }
  }

  /**
   * Set toolbar placement
   */
  setToolbarPlacement(placement: ToolbarPlacement): void {
    this.devToolbarContainer?.setAttribute('data-placement', placement);
  }

  /**
   * Clear delayed hide timeout
   */
  private clearDelayedHide(): void {
    if (this.delayedHideTimeout !== undefined) {
      window.clearTimeout(this.delayedHideTimeout);
      this.delayedHideTimeout = undefined;
    }
  }

  /**
   * Trigger delayed hide
   */
  private triggerDelayedHide(): void {
    this.clearDelayedHide();
    this.delayedHideTimeout = window.setTimeout(() => {
      this.setToolbarVisible(false);
      this.delayedHideTimeout = undefined;
    }, HOVER_DELAY);
  }

  /**
   * Register an app
   */
  registerApp(app: DevToolbarApp, builtIn = false): void {
    this.appManager.registerApp(app, builtIn);
    this.render();
  }

  /**
   * Get app manager (for external access)
   */
  getAppManager(): AppManager {
    return this.appManager;
  }
}

// Register custom elements
if (typeof window !== 'undefined') {
  if (!customElements.get('dev-toolbar')) {
    customElements.define('dev-toolbar', DevToolbar);
  }

  // Register app canvas custom element
  if (!customElements.get('dev-toolbar-app-canvas')) {
    class DevToolbarAppCanvas extends HTMLElement {
      shadowRoot: ShadowRoot;

      constructor() {
        super();
        this.shadowRoot = this.attachShadow({ mode: 'open' });
      }
    }
    customElements.define('dev-toolbar-app-canvas', DevToolbarAppCanvas);
  }
}
