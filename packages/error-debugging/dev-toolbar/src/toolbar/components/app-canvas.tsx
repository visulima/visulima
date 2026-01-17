/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";
import { render } from "preact";

import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import cn from "../../utils/cn";
import { createServerHelpers } from "../helpers";
import { sharedToolbarStylesheet } from "../stylesheet";

interface AppCanvasProps {
    /**
     * App state
     */
    app: DevToolbarAppState;

    /**
     * Toolbar placement
     */
    placement: ToolbarPlacement;
}

/**
 * App canvas component that handles both Preact and vanilla apps
 */
const AppCanvas = ({ app, placement }: AppCanvasProps): ComponentChildren => {
    const canvasRef = useRef<HTMLElement | null>(null);
    const initializedRef = useRef(false);

    const setCanvasRef = useCallback((element: HTMLElement | null) => {
        canvasRef.current = element;
    }, []);

    const isRightSide = placement.includes("right");
    const isTopSide = placement.includes("top");
    const isLeftSide = placement.includes("left");
    const isCenter = placement.includes("center");

    // Position canvas relative to toolbar placement
    // Canvas should open opposite to toolbar position:
    // - bottom toolbar → canvas above (top)
    // - right toolbar → canvas left
    // - top toolbar → canvas below (bottom)
    // - left toolbar → canvas right
    let positionClasses = "";

    if (placement.includes("bottom")) {
        // Toolbar at bottom → canvas opens above
        if (isCenter) {
            positionClasses = "bottom-[60px] left-1/2 -translate-x-1/2";
        } else if (isRightSide) {
            positionClasses = "bottom-[60px] right-4";
        } else {
            positionClasses = "bottom-[60px] left-4";
        }
    } else if (placement.includes("top")) {
        // Toolbar at top → canvas opens below
        if (isCenter) {
            positionClasses = "top-[60px] left-1/2 -translate-x-1/2";
        } else if (isRightSide) {
            positionClasses = "top-[60px] right-4";
        } else {
            positionClasses = "top-[60px] left-4";
        }
    } else if (placement.includes("right")) {
        // Toolbar at right → canvas opens to the left
        if (isCenter) {
            positionClasses = "right-[60px] top-1/2 -translate-y-1/2";
        } else if (isTopSide) {
            positionClasses = "right-[60px] top-4";
        } else {
            positionClasses = "right-[60px] bottom-4";
        }
    } else if (placement.includes("left")) {
        // Toolbar at left → canvas opens to the right
        if (isCenter) {
            positionClasses = "left-[60px] top-1/2 -translate-y-1/2";
        } else if (isTopSide) {
            positionClasses = "left-[60px] top-4";
        } else {
            positionClasses = "left-[60px] bottom-4";
        }
    }

    useEffect(() => {
        if (!app.active || !canvasRef.current) {
            return;
        }

        const canvas = canvasRef.current;

        if (!canvas.shadowRoot) {
            return;
        }

        const shadowRoot = canvas.shadowRoot;

        // Skip if already initialized
        if (initializedRef.current) {
            return;
        }

        // Adopt shared stylesheet
        if (sharedToolbarStylesheet) {
            shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
        }

        // Handle Preact component
        if (app.component) {
            const helpers = createServerHelpers();
            const container = document.createElement("div");

            shadowRoot.innerHTML = "";
            shadowRoot.appendChild(container);

            render(<app.component eventTarget={app.eventTarget} helpers={helpers} />, container);
            initializedRef.current = true;

            return () => {
                render(null, container);
            };
        }

        // Handle vanilla init function
        if (app.init) {
            const helpers = createServerHelpers();

            shadowRoot.innerHTML = "";

            // app.init can return void or Promise<void>
            const initResult = app.init(shadowRoot, app.eventTarget, helpers);

            if (initResult && typeof initResult.then === "function") {
                initResult
                    .then(() => {
                        initializedRef.current = true;
                    })
                    .catch((error) => {
                        // eslint-disable-next-line no-console
                        console.error(`[dev-toolbar] Failed to init app ${app.id}:`, error);
                    });
            } else {
                initializedRef.current = true;
            }
        }
    }, [app.active, app.id, app.component, app.init, app.eventTarget]);

    // Reset initialization flag when app becomes inactive
    useEffect(() => {
        if (!app.active) {
            initializedRef.current = false;
        }
    }, [app.active]);

    return (
        <dev-toolbar-app-canvas
            ref={setCanvasRef}
            data-app-id={app.id}
            class={cn(
                "fixed",
                positionClasses,
                "z-[2000000009] bg-[rgba(19,21,26,0.95)] border border-[#343841] rounded-lg p-4 min-w-[300px] max-w-[600px] max-h-[400px] overflow-auto",
                app.active ? "block" : "hidden",
            )}
        />
    );
};

export default AppCanvas;
