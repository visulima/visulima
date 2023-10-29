import type { Extension as IExtension, Toolbox as IToolbox } from "../@types";
import system from "../toolbox/system-tools";

/**
 * Extensions to launch processes and open files.
 *
 * @param toolbox The running toolbox.
 */
export default {
    execute: (toolbox: IToolbox) => {
        // eslint-disable-next-line no-param-reassign
        toolbox.system = system;
    },
    name: "system",
} as IExtension;
