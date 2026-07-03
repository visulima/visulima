/**
 * Type declarations for virtual modules used by the dev toolbar
 */

declare module "virtual:visulima-dev-toolbar-options" {
    interface DevToolbarVirtualOptions {
        apps: {
            a11y: boolean;
            annotations: boolean;
            assets: boolean;
            inspector: boolean;
            moduleGraph: boolean;
            performance: boolean;
            seo: boolean;
            settings: boolean;
            tailwind: boolean;
            timeline: boolean;
            viteConfig: boolean;
        };
        base: string;
        closeOnOutsideClick: boolean;
        customApps: {
            defaultOpen?: boolean;
            icon: string;
            id: string;
            name: string;
            view: { src: string; type: "iframe" };
        }[];
        defaultVisible: boolean;
        editor: string;
        height: number;
        keybindings: { close?: string; toggle?: string };
        minimizePanelInactive: number;
        placement: "bottom-left" | "bottom-center" | "bottom-right";
        position: "bottom" | "left" | "right" | "top";
        reduceMotion: boolean;
        requireUrlFlag: boolean;
        urlFlagName: string;
        width: number;
    }
    const options: DevToolbarVirtualOptions;

    export default options;
}

/**
 * Path-based virtual modules - resolved to actual dist files.
 * Each app module has a default export (the DevToolbarApp object).
 */
declare module "virtual:visulima-dev-toolbar-path:*" {
    const content: unknown;

    export default content;
}

/** Minimal app descriptor used by the library integration hook */
interface DevToolbarAppDescriptor {
    component: unknown;
    icon: string;
    id: string;
    name: string;
    tooltip?: unknown;
}

/** Timeline event shape passed to the library hook */
interface DevToolbarTimelineEvent {
    data?: unknown;
    id: string;
    level?: "error" | "info" | "warning";
    time: number;
    title: string;
}

/**
 * Library integration hook — available on window before the toolbar initializes.
 * Libraries call this to register apps and emit timeline events without depending
 * on the toolbar being fully loaded yet.
 */
interface DevToolbarHook {
    addTimelineEvent: (groupId: string, event: DevToolbarTimelineEvent) => void;
    registerApp: (app: DevToolbarAppDescriptor) => void;
}

/** Public programmatic API exposed on window after the toolbar initializes */
interface VisulimaDevTools {
    closeApp: (appId: string) => Promise<void>;
    notify: (appId: string, level: "error" | "info" | "warning") => void;
    openApp: (appId: string) => Promise<void>;
    rpc: Record<string, (...args: unknown[]) => Promise<unknown>>;
    updateSettings: (settings: Record<string, unknown>) => void;
}

declare global {
    var __VISULIMA_DEV_TOOLBAR_OPTIONS__: import("virtual:visulima-dev-toolbar-options").DevToolbarVirtualOptions | undefined;

    var __VISULIMA_DEVTOOLS_INITIALIZED__: boolean | undefined;

    var __DEV_TOOLBAR_HOOK__: DevToolbarHook | undefined;

    var __VISULIMA_DEVTOOLS__: VisulimaDevTools | undefined;
}
