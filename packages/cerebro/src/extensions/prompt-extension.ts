import { checkbox, confirm, editor, expand, input, password, rawlist, select } from "@inquirer/prompts";

import type { Extension as IExtension, Toolbox as IToolbox } from "../@types";

/**
 * Provides user input prompts via inquirer.
 *
 * @param toolbox The running toolbox.
 */
export default {
    execute: (toolbox: IToolbox) => {
        // eslint-disable-next-line no-param-reassign
        toolbox.prompts = {
            checkbox,
            confirm,
            editor,
            expand,
            input,
            password,
            rawlist,
            select,
        };
    },
    name: "prompt",
} as IExtension;
