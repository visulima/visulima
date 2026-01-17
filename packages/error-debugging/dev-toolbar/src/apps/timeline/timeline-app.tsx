/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import type { AppComponentProps } from "../../types/app";

/**
 * Timeline app component
 */
const TimelineApp = (_props: AppComponentProps): ComponentChildren => {
    return (
        <div class="p-4 text-white">
            <h2 class="text-xl font-semibold mb-2">Timeline</h2>
            <p class="text-sm text-gray-300">Timeline viewer coming soon...</p>
        </div>
    );
};

export default TimelineApp;
