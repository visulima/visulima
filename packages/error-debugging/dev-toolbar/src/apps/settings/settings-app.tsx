/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import type { AppComponentProps } from "../../types/app";

/**
 * Settings app component
 */
const SettingsApp = (_props: AppComponentProps): ComponentChildren => {
    return (
        <div class="p-4 text-white">
            <h2 class="text-xl font-semibold mb-2">Settings</h2>
            <p class="text-sm text-gray-300">Settings panel coming soon...</p>
        </div>
    );
};

export default SettingsApp;
