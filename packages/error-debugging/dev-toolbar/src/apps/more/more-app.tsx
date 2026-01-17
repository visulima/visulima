/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import type { AppComponentProps } from "../../types/app";

/**
 * More apps component
 */
const MoreApp = (_props: AppComponentProps): ComponentChildren => {
    return (
        <div class="p-4 text-white">
            <h2 class="text-xl font-semibold mb-2">More Apps</h2>
            <p class="text-sm text-gray-300">More apps panel coming soon...</p>
        </div>
    );
};

export default MoreApp;
