import type { Extension as IExtension, Toolbox as IToolbox } from "../@types";
import printTools from "../toolbox/print-tools";

/**
 * Extensions to print to the console.
 *
 * @param toolbox The running toolbox.
 */
export default {
    execute: (toolbox: IToolbox): void => {
        // attach the feature set
        // eslint-disable-next-line no-param-reassign
        toolbox.print = printTools;
    },
    name: "print",
} as IExtension;
