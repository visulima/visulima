import { checkbox, confirm, editor, expand, input, password, rawlist, select } from "@inquirer/prompts";

const promptsExtension = {
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
};

export default promptsExtension;
