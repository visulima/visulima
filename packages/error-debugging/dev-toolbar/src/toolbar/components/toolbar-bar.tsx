/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import { useApps } from "../hooks/index";
import AppButton from "./app-button";
import ViteOverlayButton from "./vite-overlay-button";

/**
 * Toolbar bar — row of app buttons inside the pill.
 * Left/right placement rotates the whole pill 90deg via CSS,
 * so this always stays flex-row internally.
 */
const ToolbarBar = (): ComponentChildren => {
    const { apps } = useApps();

    return (
        <div class="flex items-center pointer-events-auto" id="__v_dt__bar">
            <div class="flex flex-row items-center justify-start gap-1" id="__v_dt__bar_container">
                {apps.map((app) => (
                    <AppButton app={app} key={app.id} />
                ))}
                <ViteOverlayButton />
            </div>
        </div>
    );
};

export default ToolbarBar;
