/** @jsxImportSource preact */

import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import alertTriangleIcon from "lucide-static/icons/alert-triangle.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import Icon from "../../ui/components/icon";

/**
 * Shows a red error button in the toolbar when `@visulima/vite-overlay` errors exist.
 * Clicking toggles the vite-overlay panel visibility.
 *
 * Only rendered when:
 * - `@visulima/vite-overlay` is installed and active (window.ErrorOverlay is defined)
 * - At least one error is present in the history
 *
 * Renders with its own left separator so it stays visually grouped on the
 * right side of the toolbar, distinct from the regular app buttons.
 */
const ViteOverlayButton = (): ComponentChildren => {
    const [errorCount, setErrorCount] = useState(0);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    useEffect(() => {
        const sync = () => {
            const history = (globalThis as any).__v_o_error_history;
            const count = Array.isArray(history) ? history.length : 0;

            setErrorCount(count);

            const overlay = (globalThis as any).__v_o__current;

            if (overlay?.parentNode) {
                const rootElement = overlay.shadowRoot?.querySelector("#__v_o__root") as HTMLElement | undefined;

                setIsOverlayOpen(!!rootElement && !rootElement.classList.contains("hidden"));
            } else {
                setIsOverlayOpen(false);
            }
        };

        const id = setInterval(sync, 300);

        sync();

        return () => {
            clearInterval(id);
        };
    }, []);

    if (errorCount === 0) {
        return undefined;
    }

    const handleClick = () => {
        const overlay = (globalThis as any).__v_o__current;

        if (!overlay?.parentNode) {
            return;
        }

        const rootElement = overlay.shadowRoot?.querySelector("#__v_o__root") as HTMLElement | undefined;

        if (rootElement?.classList.contains("hidden")) {
            rootElement.classList.remove("hidden");
            setIsOverlayOpen(true);
        } else if (typeof overlay.close === "function") {
            overlay.close();
            setIsOverlayOpen(false);
        }
    };

    const label = `${errorCount} error${errorCount === 1 ? "" : "s"} – click to ${isOverlayOpen ? "hide" : "show"} overlay`;

    return (
        <>
            {/* Separator — same style as the divider between logo and app buttons */}
            <div aria-hidden="true" class="w-px h-5 bg-primary/20 shrink-0 mx-0.5" />
            <button
                aria-label={label}
                class={clsx(
                    "relative flex justify-center items-center size-6",
                    "border-0",
                    "whitespace-nowrap no-underline p-0 m-0",
                    "cursor-pointer",
                    "bg-transparent text-destructive",
                    "transition-all duration-150",
                    "hover:bg-destructive/8",
                    "active:scale-[0.94]",
                    "group-data-[vertical]/panel:rotate-[-90deg]",
                )}
                onClick={handleClick}
                title={label}
                type="button"
            >
                <div class="relative size-6 select-none flex items-center justify-center">
                    <Icon size={16} src={alertTriangleIcon} />
                    <span class="absolute -top-0.5 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-destructive text-white text-[9px] font-bold leading-none flex items-center justify-center border border-background">
                        {errorCount > 9 ? "9+" : errorCount}
                    </span>
                </div>
            </button>
        </>
    );
};

export default ViteOverlayButton;
