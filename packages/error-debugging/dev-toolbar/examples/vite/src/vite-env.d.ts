/// <reference types="vite/client" />

declare global {
    interface Window {
        __VISULIMA_DEVTOOLS__?: import("@visulima/dev-toolbar").VisulimaDevTools;
        __DEV_TOOLBAR_HOOK__?: import("@visulima/dev-toolbar").DevToolbarHook;
        __VISULIMA_DEVTOOLS_INITIALIZED__?: boolean;
    }
}

export {};
