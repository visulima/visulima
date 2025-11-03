import { createTable } from "@visulima/tabular";
import { NO_BORDER } from "@visulima/tabular/style";

import type { ArgumentDefinition, OptionDefinition as IOptionDefinition } from "../../../types/command";
import type { OptionList as IOptionList } from "../../../types/command-line-usage";
import templateFormat from "../../text-processing/template-format";
import BaseSection from "./base-section";

class OptionListSection extends BaseSection {
    public constructor(data: IOptionList) {
        super();

        let definitions = data.optionList ?? [];

        const hide = Array.isArray(data.hide) ? data.hide : ([data.hide].filter(Boolean) as string[]);
        const groups = Array.isArray(data.group) ? data.group : ([data.group].filter(Boolean) as string[]);

        /* filter out hidden definitions */
        if (hide.length > 0) {
            definitions = definitions.filter((definition) => !hide.includes(definition.name));
        }

        if (data.header) {
            this.header(templateFormat(data.header));
        }

        if (groups.length > 0) {
            definitions = definitions.filter((definition) => {
                const noGroupMatch = groups.includes("_none") && !definition.group;
                const groupMatch = this.intersect(Array.isArray(definition.group) ? definition.group : [definition.group], groups);

                return noGroupMatch || groupMatch ? definition : undefined;
            });
        }

        const table = createTable({
            showHeader: false,
            style: {
                border: NO_BORDER,
                paddingLeft: 2,
                paddingRight: 1,
            },
            wordWrap: true,
        });

        definitions.forEach((definition) =>
            table.addRow([this.getOptionNames(definition, data.reverseNameOrder ?? false, data.isArgument ?? false), templateFormat(definition.description)]),
        );

        this.add(table.toString());

        this.lines.push("");
    }

    // eslint-disable-next-line class-methods-use-this,sonarjs/cognitive-complexity,@typescript-eslint/no-explicit-any
    private getOptionNames(definition: ArgumentDefinition | IOptionDefinition<any>, reverseNameOrder: boolean, isArgument: boolean): string {
        if (!definition.name) {
            throw new TypeError("Invalid option definition, name is required.");
        }

        let type = definition.type ? definition.type.name.toLowerCase() : "string";

        const multiple = definition.multiple || definition.lazyMultiple ? "[]" : "";

        type = templateFormat(definition.typeLabel ?? `{underline ${type}${multiple}}`);

        let result: string;

        if (definition.alias) {
            if (definition.name) {
                const name = isArgument ? definition.name : `{yellow --${definition.name}}`;

                result = reverseNameOrder
                    ? templateFormat(`{bold ${name}}, {bold -${definition.alias}} ${type}`)
                    : templateFormat(`{bold -${definition.alias}}, {bold ${name}} ${type}`);
            } else if (reverseNameOrder) {
                result = templateFormat(`{bold -${definition.alias}} ${type}`);
            } else {
                result = templateFormat(`{bold -${definition.alias}} ${type}`);
            }
        } else {
            result = templateFormat(`{bold ${isArgument ? definition.name : `{yellow --${definition.name}}`}} ${type}`);
        }

        return result;
    }

    // eslint-disable-next-line class-methods-use-this
    private intersect(array1: (string | undefined)[], array2: (string | undefined)[]) {
        return array1.some((item1) => array2.includes(item1));
    }
}

/**
 * An OptionList section adds a table displaying the supplied option definitions.
 * @property {string} [header] - The section header, always bold and underlined.
 * @property optionList {OptionDefinition[]} - An array of [option definition](https://github.com/75lb/command-line-args/blob/master/doc/option-definition.md) objects. In addition to the regular definition properties, command-line-usage will look for:
 *
 * - `description` - a string describing the option.
 * - `typeLabel` - a string to replace the default type string (e.g. `&lt;string>`). It's often more useful to set a more descriptive type label, like `&lt;ms>`, `&lt;files>`, `&lt;command>` etc.
 * @property {string|string[]} [group] - If specified, only options from this particular group will be printed. [Example](https://github.com/75lb/command-line-usage/blob/master/example/groups.js).
 * @property {string|string[]} [hide] - The names of one of more option definitions to hide from the option list. [Example](https://github.com/75lb/command-line-usage/blob/master/example/hide.js).
 * @property {boolean} [reverseNameOrder] - If true, the option alias will be displayed after the name, i.e. `--verbose, -v` instead of `-v, --verbose`).
 * @property {object} [tableOptions] - An options object suitable for passing into [table-layout](https://github.com/75lb/table-layout#table-). See [here for an example](https://github.com/75lb/command-line-usage/blob/master/example/option-list-options.js).
 * @example
 * {
 *   header: 'Options',
 *   optionList: [
 *     {
 *       name: 'help',
 *       alias: 'h',
 *       description: 'Display this usage guide.'
 *     },
 *     {
 *       name: 'src',
 *       description: 'The input files to process',
 *       multiple: true,
 *       defaultOption: true,
 *       typeLabel: '{underline file} ...'
 *     },
 *     {
 *       name: 'timeout',
 *       description: 'Timeout value in ms.',
 *       alias: 't',
 *       typeLabel: '{underline ms}'
 *     }
 *   ]
 * }
 */
export default OptionListSection;
