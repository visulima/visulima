import CliTable from "cli-table3";
import stringWidth from "string-width";
import terminalSize from "term-size";

import type { PrintTableOptions as IPrintTableOptions } from "../@types";
import { CLI_TABLE_COMPACT, CLI_TABLE_MARKDOWN } from "./constants";

const getColumnWidths = (value: string[]): number[] => {
    const columnSizes: number[] = [];

    value.forEach((column, index) => {
        const size = stringWidth(String(column));

        // eslint-disable-next-line security/detect-object-injection
        const existingSize = columnSizes[index];

        if (!existingSize || existingSize < size) {
            // eslint-disable-next-line security/detect-object-injection
            columnSizes[index] = size;
        }
    });

    return columnSizes;
};

const scaleEqual = (input: number[], size: number): number[] => {
    const totalSum = input.reduce((previous, current) => previous + current, 0);
    const scale = size / totalSum;

    return input.map((element) => Math.round(element * scale));
};

const findMaxValues = (data: number[][]): number[] => {
    const maxLength = Math.max(...data.map((array) => array.length));
    const result: number[] = Array.from<number>({ length: maxLength }).fill(Number.NEGATIVE_INFINITY);

    data.forEach((array) => {
        array.forEach((value, index) => {
            // eslint-disable-next-line security/detect-object-injection
            if (value > (result[index] as number)) {
                // eslint-disable-next-line security/detect-object-injection
                result[index] = value + 1;
            }
        });
    });

    return result;
};

/**
 * Print a table with the given data and options.
 *
 * @param head - The table head.
 * @param data - The table data.
 * @param options - The table printing options.
 *
 * @example
 * ```ts
 * toolbox.print.table(
 *   ['First Name', 'Last Name', 'Age'],
 *   [
 *     ['Jamon', 'Holmgren', 35],
 *     ['Gant', 'Laborde', 36],
 *     ['Steve', 'Kellock', 43],
 *     ['Gary', 'Busey', 73],
 *   ],
 *   { format: 'markdown' },
 * );
 *
 * Outputs:
 * | First Name | Last Name | Age |
 * | ---------- | --------- | --- |
 * | Jamon      | Holmgren  | 35  |
 * | Gant       | Laborde   | 36  |
 * | Steve      | Kellock   | 43  |
 * | Gary       | Busey     | 73  |
 * ```
 * @example
 * ```ts
 * toolbox.print.table(
 *   ['First Name', 'Last Name', 'Age'],
 *   [
 *     ['Jamon', 'Holmgren', 35],
 *     ['Gant', 'Laborde', 36],
 *     ['Steve', 'Kellock', 43],
 *     ['Gary', 'Busey', 73],
 *   ],
 *   {
 *     format: 'lean',
 *     style: { 'padding-left': 0 , 'padding-right': 8 }
 *   },
 * );
 *
 * Outputs:
 * ┌──────────────────┬─────────────────┬───────────┐
 * │First Name        │Last Name        │Age        │
 * ├──────────────────┼─────────────────┼───────────┤
 * │Jamon             │Holmgren         │35         │
 * ├──────────────────┼─────────────────┼───────────┤
 * │Gant              │Laborde          │36         │
 * ├──────────────────┼─────────────────┼───────────┤
 * │Steve             │Kellock          │43         │
 * ├──────────────────┼─────────────────┼───────────┤
 * │Gary              │Busey            │73         │
 * └──────────────────┴─────────────────┴───────────┘
 * ```
 */
const table = (head: string[], data: string[][], options: IPrintTableOptions = {}): void => {
    const config = {
        fluidColumnIndex: 0,
        format: "default",
        fullWidth: false,
        padding: 2,
        ...options,
    };

    const { columns: columnsWidth } = terminalSize();
    const columnSizes: number[][] = [getColumnWidths(head), ...data.map((row) => getColumnWidths(row))];

    if (config.fullWidth) {
        config.colWidths = scaleEqual(findMaxValues(columnSizes), columnsWidth);
    }

    if (config.format === "markdown") {
        const markdownTable = new CliTable({
            chars: CLI_TABLE_MARKDOWN,
            head,
            wordWrap: true,
            ...(config.colWidths ? { colWidths: config.colWidths.map((w) => w - config.padding) } : {}),
        });

        markdownTable.push(...data);

        if (head.length > 0) {
            let size = findMaxValues(columnSizes);

            if (config.fullWidth) {
                size = scaleEqual(size, columnsWidth).map((w) => w - (config.padding + 1));
            }

            markdownTable.unshift(size.map((w) => Array.from({ length: w }).join("-")));
        }

        // Resets the padding of a table.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (markdownTable.options.style) {
            markdownTable.options.style["padding-left"] = 1;
            markdownTable.options.style["padding-right"] = 1;
        }

        console.log(markdownTable.toString());
    } else if (config.format === "lean") {
        const leanTable = new CliTable({
            head,
            wordWrap: true,
            ...(config.colWidths ? { colWidths: config.colWidths.map((w) => w - config.padding) } : {}),
        });
        leanTable.push(...data);

        console.log(leanTable.toString());
    } else {
        const defaultTable = new CliTable({
            chars: CLI_TABLE_COMPACT,
            head,
            wordWrap: true,
            ...(config.colWidths ? { colWidths: config.colWidths } : {}),
        });
        defaultTable.push(...data);

        console.log(defaultTable.toString());
    }
};

export default table;
