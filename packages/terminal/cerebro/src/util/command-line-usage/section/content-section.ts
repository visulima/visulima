// eslint-disable-next-line import/no-extraneous-dependencies -- bundled into dist by packem; kept a devDependency on purpose
import { getStringWidth } from "@visulima/string";
import { createTable } from "@visulima/tabular";
import { NO_BORDER } from "@visulima/tabular/style";
// eslint-disable-next-line import/no-extraneous-dependencies -- bundled into dist by packem; kept a devDependency on purpose
import terminalSize from "terminal-size";

import type { Content as IContent } from "../../../types/command-line-usage";
import templateFormat from "../../text-processing/template-format";
import getTerminalWidth from "../get-terminal-width";
import BaseSection from "./base-section";

/**
 * Resolve a terminal width for column-width math. Prefers an explicit
 * `CEREBRO_TERMINAL_WIDTH` override, then delegates to `terminal-size`,
 * which handles TTY ioctl, the `COLUMNS` env var, and falls back to `80`
 * in non-interactive contexts (CI, piped output, tests).
 */
const resolveTerminalWidth = (override: number | undefined): number => {
    if (override !== undefined && override > 0) {
        return override;
    }

    return terminalSize().columns;
};

/**
 * For 2-column rows (e.g. command-name + description), pin both columns to
 * fixed widths so long names like `migrate lint-staged` never wrap mid-name
 * and every description starts in the same column. Returns `undefined` when
 * sizing should fall back to tabular's automatic layout (single-column rows,
 * mixed shapes, or when the widest name would leave less than ~20 cols for
 * the description). Returned widths include cell padding because tabular's
 * `columnWidths` API expects total cell width.
 */
const computeColumnWidths = (formattedRows: string[][], terminalWidth: number, leftPad: number, rightPad: number): [number, number] | undefined => {
    if (formattedRows.length === 0 || formattedRows.some((row) => row.length !== 2)) {
        return undefined;
    }

    let widest = 0;

    for (const row of formattedRows) {
        const cell = row[0];

        if (cell === undefined) {
            continue;
        }

        const width = getStringWidth(cell);

        if (width > widest) {
            widest = width;
        }
    }

    if (widest === 0) {
        return undefined;
    }

    const totalPadding = leftPad + rightPad;
    const firstColumnTotal = widest + totalPadding;

    // Reserve at least 20 cols of content for the description after padding;
    // otherwise pinning the name column would crush the right-hand text.
    const minDescriptionContent = 20;
    const minSecondColumnTotal = minDescriptionContent + totalPadding;

    if (firstColumnTotal + minSecondColumnTotal > terminalWidth) {
        return undefined;
    }

    const secondColumnTotal = terminalWidth - firstColumnTotal;

    return [firstColumnTotal, secondColumnTotal];
};

/**
 * A Content section comprises a header and one or more lines of content.
 * @property header The section header, always bold and underlined.
 * @property content Overloaded property, accepting data in one of four formats:
 *
 * 1. A single string (one line of text)
 * 2. An array of strings (multiple lines of text)
 * 3. An array of objects (recordset-style data). In this case, the data will be rendered in table format. The property names of each object are not important, so long as they are consistent throughout the array.
 * 4. An object with two properties - `data` and `options`. In this case, the data and options will be passed directly to the underlying [table](https://github.com/visulima/visulima/tree/main/packages/tabular) module for rendering.
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
                            row.forEach((cell) => {
                                this.add(templateFormat(cell as string | undefined));
                            });
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
            const table = createTable({
                showHeader: false,
                style: {
                    border: NO_BORDER,
                    paddingLeft: 4,
                    paddingRight: 1,
                },
                terminalWidth: getTerminalWidth(),
                truncateOverflow: false,
                wordWrap: true,
            });

            table.addRow([templateFormat(content)]);

            return table.toString();
        }

        if (
            Array.isArray(content)
            // eslint-disable-next-line @typescript-eslint/no-shadow
            && content.every((value) => typeof value === "string" || (Array.isArray(value) && value.every((value) => typeof value === "string")))
        ) {
            const paddingLeft = 4;
            const paddingRight = 1;
            const resolvedTerminalWidth = resolveTerminalWidth(getTerminalWidth());

            const formatRow = (row: string | string[]): string[] => {
                if (Array.isArray(row)) {
                    return row.map((cell) => templateFormat(cell));
                }

                return [templateFormat(row)];
            };
            const formattedRows: string[][] = content.map((row) => formatRow(row));

            const columnWidths = computeColumnWidths(formattedRows, resolvedTerminalWidth, paddingLeft, paddingRight);

            const table = createTable({
                columnWidths,
                showHeader: false,
                style: {
                    border: NO_BORDER,
                    paddingLeft,
                    paddingRight,
                },
                terminalWidth: resolvedTerminalWidth,
                truncateOverflow: false,
                wordWrap: true,
            });

            formattedRows.forEach((row) => {
                if (columnWidths !== undefined && row.length === 2) {
                    // Disable wrap on column 0 so multi-token names (e.g.
                    // `migrate lint-staged`, `security run`, `check [c, outdated]`)
                    // stay on a single line. Width comes from table-level
                    // `columnWidths`, which keeps every row aligned to the widest name.
                    table.addRow([{ content: row[0] as string, wordWrap: false }, row[1]]);
                } else {
                    table.addRow(row);
                }
            });

            return table.toString();
        }

        if (typeof content === "object") {
            const contentObject = content as { data?: string[] | string[][]; options?: Record<string, unknown> };

            if (!contentObject.options || !contentObject.data) {
                throw new Error(`Must have an "options" or "data" property\n${JSON.stringify(content)}`);
            }

            const table = createTable({
                showHeader: false,
                style: {
                    border: NO_BORDER,
                    paddingLeft: 4,
                    paddingRight: 1,
                },
                terminalWidth: getTerminalWidth(),
                truncateOverflow: false,
                wordWrap: true,
            });

            contentObject.data.forEach((row) => {
                if (Array.isArray(row)) {
                    table.addRow(row.map((cell) => templateFormat(cell)));
                } else {
                    table.addRow([templateFormat(row)]);
                }
            });

            return table.toString();
        }

        throw new Error(`invalid input - 'content' must be a string, array of strings or a object:\n\n${JSON.stringify(content)}`);
    }
}

export default ContentSection;
