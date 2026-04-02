import type { Plugin } from "@visulima/cerebro";

import { showTip } from "../tips";

const postCommandPlugin = (upgradeCheckCallback?: () => void): Plugin => ({
    afterCommand: async () => {
        const args = process.argv.slice(2);
        const command = args[0] ?? "";

        // Upgrade notice first (per RFC: "notice first, then tip")
        if (upgradeCheckCallback) {
            upgradeCheckCallback();
        }

        // Then contextual tips
        showTip({ args, command, success: process.exitCode === undefined || process.exitCode === 0 });
    },
    name: "post-command",
});

export default postCommandPlugin;
