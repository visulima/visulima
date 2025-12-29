/// <reference types="vite/client" />

import type { DevToolbarHook, VisulimaDevTools } from "@visulima/dev-toolbar";

declare global {
    interface Window {
        __DEV_TOOLBAR_HOOK__?: DevToolbarHook;
        __VISULIMA_DEVTOOLS__?: VisulimaDevTools;
        __VISULIMA_DEVTOOLS_INITIALIZED__?: boolean;
    }

    // Extend globalThis for better type support
    // eslint-disable-next-line no-var
    var __DEV_TOOLBAR_HOOK__: DevToolbarHook | undefined;
    // eslint-disable-next-line no-var
    var __VISULIMA_DEVTOOLS__: VisulimaDevTools | undefined;
    // eslint-disable-next-line no-var
    var __VISULIMA_DEVTOOLS_INITIALIZED__: boolean | undefined;
}
