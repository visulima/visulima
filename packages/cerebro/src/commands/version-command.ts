import type { Command as ICommand } from "../types/command";

export default {
    alias: ["v", "V"],
    description: "Output the version number",
    execute: ({ logger, runtime }) => {
        const version = runtime.getPackageVersion();

        if (version === undefined) {
            logger.warn("Unknown version");
            logger.debug("The version number was not provided by the cli constructor.");
        } else {
            logger.info(version);
        }
    },
    name: "version",
    options: [],
    usage: [],
} as ICommand;
