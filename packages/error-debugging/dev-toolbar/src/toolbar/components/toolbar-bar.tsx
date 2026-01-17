/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import cn from "../../utils/cn";
import { useApps } from "../hooks/index";
import AppButton from "./app-button";

/**
 * More apps button component
 */
const MoreButton = ({ isHorizontal }: { isHorizontal: boolean }): ComponentChildren => {
    const { toggleApp } = useApps();

    const handleClick = (): void => {
        toggleApp("dev-toolbar:more").catch((error) => {
            console.error("[dev-toolbar] Failed to toggle more app:", error);
        });
    };

    return (
        <button
            class={cn(
                isHorizontal ? "flex justify-center items-center h-11 w-10" : "flex justify-center items-center w-11 h-10",
                "border-0 bg-transparent text-white font-sans text-base leading-tight whitespace-nowrap no-underline p-0 m-0 overflow-hidden transition-opacity duration-200 ease-out cursor-pointer hover:bg-white/12.5 focus-visible:bg-white/12.5 focus-visible:-outline-offset-3",
            )}
            data-app-id="dev-toolbar:more"
            onClick={handleClick}
            type="button"
        >
            <div class="relative max-w-5 max-h-5 select-none">⋯</div>
        </button>
    );
};

interface ToolbarBarProps {
    /**
     * Whether toolbar is on right side (horizontal layout)
     */
    isRightSide?: boolean;

    /**
     * Number of custom apps to show before "more" button
     */
    customAppsToShow?: number;
}

/**
 * Toolbar bar component with app buttons
 */
const ToolbarBar = ({ isRightSide = false, customAppsToShow = 3 }: ToolbarBarProps): ComponentChildren => {
    const { apps } = useApps();

    const builtInApps = apps.filter((app) => app.builtIn);
    const customApps = apps.filter((app) => !app.builtIn);
    const visibleApps = [...builtInApps, ...customApps.slice(0, customAppsToShow)];
    const overflowApps = customApps.slice(customAppsToShow);

    const containerClasses = isRightSide ? "h-full flex-col" : "h-full flex";
    const barClasses = isRightSide ? "w-10 h-auto" : "h-10 w-auto";

    return (
        <div id="dev-bar" class={cn(barClasses, "overflow-hidden pointer-events-auto border border-[#343841] rounded-lg")}>
            <div id="bar-container" class={containerClasses}>
                {visibleApps.map((app) => (
                    <AppButton key={app.id} app={app} isHorizontal={isRightSide} />
                ))}
                {overflowApps.length > 0 && <MoreButton isHorizontal={isRightSide} />}
            </div>
        </div>
    );
};

export default ToolbarBar;
