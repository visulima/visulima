import type { Command as ICommand } from "../@types";

export default {
    alias: ["v", "V"],
    options: [],
    description: "Output the version number",
    execute: (toolbox) => {
        toolbox.logger.info(toolbox.runtime.getPackageVersion());
    },
    name: "version",
    usage: [],
} as ICommand;
