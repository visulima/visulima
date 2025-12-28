import type { VisulimaDevTools } from '../types/global-api.js';
import type { DevToolbarApp, ToolbarSettings } from '../types/index.js';
import type { ServerFunctions } from '../types/rpc.js';
import type { DevToolbarHook } from '../types/hooks.js';
import { loadSettings, updateSettings } from './settings.js';
import { createClientRPCContext } from '../rpc/client.js';
import { getGlobalHook } from '../hooks/index.js';

/**
 * Global DevTools API implementation
 */
export const createGlobalAPI = (
  appManager: { getApps: () => DevToolbarApp[]; getActiveApp: () => DevToolbarApp | undefined; toggleApp: (id: string) => Promise<boolean>; registerApp: (app: DevToolbarApp) => void; unregisterApp: (id: string) => void; setNotification: (id: string, state: boolean, level?: 'info' | 'warning' | 'error') => void; clearNotification: (id: string) => void },
  toolbar: { show: () => void; hide: () => void; toggle: () => void },
): VisulimaDevTools => {
  const rpcContext = createClientRPCContext();
  const hook = getGlobalHook();

  if (!hook) {
    throw new Error('Global hook not initialized');
  }

  return {
    show(): void {
      toolbar.show();
    },

    hide(): void {
      toolbar.hide();
    },

    toggle(): void {
      toolbar.toggle();
    },

    async openApp(appId: string): Promise<void> {
      await appManager.toggleApp(appId);
    },

    async closeApp(): Promise<void> {
      const activeApp = appManager.getActiveApp();
      if (activeApp) {
        await appManager.toggleApp(activeApp.id);
      }
    },

    getActiveApp(): string | null {
      const activeApp = appManager.getActiveApp();
      return activeApp?.id || null;
    },

    registerApp(app: DevToolbarApp): void {
      appManager.registerApp(app);
    },

    unregisterApp(appId: string): void {
      appManager.unregisterApp(appId);
    },

    getApps(): DevToolbarApp[] {
      return appManager.getApps();
    },

    notify(appId: string, level: 'info' | 'warning' | 'error'): void {
      appManager.setNotification(appId, true, level);
    },

    clearNotification(appId: string): void {
      appManager.clearNotification(appId);
    },

    getSettings(): ToolbarSettings {
      return loadSettings();
    },

    updateSettings(settings: Partial<ToolbarSettings>): void {
      updateSettings(settings);
    },

    rpc: new Proxy({} as ServerFunctions, {
      get(_target, prop: string) {
        return (...args: any[]) => rpcContext.callServer(prop as any, ...args);
      },
    }),

    hook,

    version: '0.0.0', // Will be replaced with actual version from package.json
  };
};

/**
 * Setup global API on window object
 * @param api - API instance
 */
export const setupGlobalAPI = (api: VisulimaDevTools): void => {
  if (typeof window !== 'undefined') {
    window.__VISULIMA_DEVTOOLS__ = api;
  }
};
