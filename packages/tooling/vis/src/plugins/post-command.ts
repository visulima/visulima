import type { Plugin } from "@visulima/cerebro";

import { showMcpPromote } from "../util/mcp-promote";
import { showSponsorNotice } from "../util/sponsor";
import { showTip } from "../util/tips";

const postCommandPlugin = (upgradeCheckCallback?: () => void): Plugin => {
    return {
        afterCommand: async (toolbox) => {
            const args = process.argv.slice(2);
            const command = args[0] ?? "";
            const success = process.exitCode === undefined || process.exitCode === 0;

            if (upgradeCheckCallback) {
                upgradeCheckCallback();
            }

            showTip({
                args,
                command,
                hasVisConfig: toolbox.visConfig !== undefined && Object.keys(toolbox.visConfig).length > 0,
                success,
            });

            showSponsorNotice({ success, visConfig: toolbox.visConfig });
            showMcpPromote({ command, success, visConfig: toolbox.visConfig });
        },
        name: "post-command",
    };
};

export default postCommandPlugin;
