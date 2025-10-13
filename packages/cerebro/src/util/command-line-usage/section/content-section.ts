import type { TableInstanceOptions } from "cli-table3";
import CliTable3 from "cli-table3";

import type { Content as IContent } from "../../../@types/command-line-usage";
import templateFormat from "../../template-format";
import BaseSection from "./base-section";

const defaultTableOptions: Partial<TableInstanceOptions> = {
    chars: {
        bottom: "",
        "bottom-left": "",
        "bottom-mid": "",
        "bottom-right": "",
        left: " ",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        middle: " ",
        right: "",
        "right-mid": "",
        top: "",
        "top-left": "",
        "top-mid": "",
        "top-right": "",
    },
    colWidths: [40, 60],
    style: { border: [], compact: true, head: [], "padding-left": 2, "padding-right": 1 },
    wordWrap: true,
};

/**
 * A Content section comprises a header and one or more lines of content.
 * @property header The section header, always bold and underlined.
 * @property content Overloaded property, accepting data in one of four formats:
 *
 * 1. A single string (one line of text)
 * 2. An array of strings (multiple lines of text)
 * 3. An array of objects (recordset-style data). In this case, the data will be rendered in table format. The property names of each object are not important, so long as they are consistent throughout the array.
 * 4. An object with two properties - `data` and `options`. In this case, the data and options will be passed directly to the underlying [table](https://github.com/cli-table/cli-table3) module for rendering.
 * @property raw - Set to true to avoid indentation and wrapping. Useful for banners.
 * @example
 * Simple string of content. For ansi formatting, use [colorize template literal syntax](https://github.com/visulima/visulima/tree/main/packages/colorize#tagged-template-literals).
 * ```js
 * {
 *   header: 'A typical app',
 *   content: 'Generates something {rgb(255,200,0).italic very {underline.bgRed important}}.'
 * }
 * ```
 *
 * An array of strings is interpreted as lines, to be joined by the system newline character.
 * ```js
 * {
 *   header: 'A typical app',
 *   content: [
 *     'First line.',
 *     'Second line.'
 *   ],
 * }
 * ```
 *
 * An array of arrays is rendered in table layout.
 * ```js
 * {
 *   header: 'A typical app',
 *   content: [
 *     [ 'First row, first column.', 'First row, second column.', ],
 *     [ 'Second row, first column.', 'Second row, second column.', ],
 *   ]
 * }
 * ```
 *
 * An object with `data` and `options` properties will be passed directly to the underlying [table](https://github.com/cli-table/cli-table3) module for rendering.
 * ```js
 * {
 *   header: 'A typical app',
 *   content: {
 *     data: [
 *         [ 'First row, first column.', 'First row, second column.', ],
 *         [ 'Second row, first column.', 'Second row, second column.', ],
 *         'Second row, first column.',
 *     ],
 *     options: {
 *       colWidths: [80],
 *     }
 *   }
 * }
 * ```
 */
class ContentSection extends BaseSection {
    public constructor(section: IContent) {
        super();

        if (section.header) {
            this.header(templateFormat(section.header));
        }

        if (section.content) {
            /* add content without indentation or wrapping */
            if (section.raw) {
                if (Array.isArray(section.content) && section.content.every((value) => typeof value === "string")) {
                    section.content.forEach((row) => {
                        if (Array.isArray(row)) {
                            row.forEach((cell) => this.add(templateFormat(cell as string | undefined)));
                        } else {
                            this.add(templateFormat(row));
                        }
                    });
                } else if (typeof section.content === "string") {
                    this.add(templateFormat(section.content));
                } else {
                    throw new TypeError("Invalid raw content, must be a string or array of strings.");
                }
            } else {
                this.add(this.getContentLines(section.content));
            }

            this.add("");
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private getContentLines(content: IContent["content"]) {
        if (typeof content === "string") {
            const table = new CliTable3({
                ...defaultTableOptions,
                colWidths: [80],
            });

            table.push([templateFormat(content)]);

            return table.toString();
        }

        if (
            Array.isArray(content)
            // eslint-disable-next-line @typescript-eslint/no-shadow
            && content.every((value) => typeof value === "string" || (Array.isArray(value) && value.every((value) => typeof value === "string")))
        ) {
            const table = new CliTable3({
                ...defaultTableOptions,
            });

            content.forEach((row) => {
                if (Array.isArray(row)) {
                    table.push(row.map((cell) => templateFormat(cell)));
                } else {
                    table.push([templateFormat(row)]);
                }
            });

            return table.toString();
        }

        if (typeof content === "object") {
            const contentObject = content as { data?: string[] | string[][]; options?: TableInstanceOptions };

            if (!contentObject.options || !contentObject.data) {
                throw new Error(`Must have an "options" or "data" property\n${JSON.stringify(content)}`);
            }

            const table = new CliTable3({
                ...defaultTableOptions,
                ...contentObject.options,
                style: { ...defaultTableOptions.style, ...contentObject.options.style },
            });

            contentObject.data.forEach((row) => {
                if (Array.isArray(row)) {
                    table.push(row.map((cell) => templateFormat(cell)));
                } else {
                    table.push([templateFormat(row)]);
                }
            });

            return table.toString();
        }

        throw new Error(`invalid input - 'content' must be a string, array of strings or a object:\n\n${JSON.stringify(content)}`);
    }
}

export default ContentSection;
