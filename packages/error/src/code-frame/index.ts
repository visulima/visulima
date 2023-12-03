/**
 * This is a modified copy of the codeFrameColumns function from Babel
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/src/index.ts#L145-L217
 *
 * MIT License
 *
 * Copyright (c) 2014-present Sebastian McKenzie and other contributors
 */

import process from "../util/process";
import normalizeLF from "../util/normalize-lf";
import type { CodeFrameNodeLocation, CodeFrameOptions, ColorizeMethod } from "../types";
import getMarkerLines from "./get-marker-lines";

const POINTER = process.platform === "win32" && !process.env?.["WT_SESSION"] ? ">" : "❯";

/** Generate a code frame from string and an error location */
export const codeFrame = (
    source: string,
    loc: CodeFrameNodeLocation,
    options: Partial<CodeFrameOptions> = {},
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string => {
    // grab 2 lines before, and 3 lines after focused line
    const config = {
        linesAbove: 2,
        linesBelow: 3,
        showLineNumbers: true,
        showGutter: true,
        color: {
            gutter: (value: string) => value,
            marker: (value: string) => value,
            message: (value: string) => value,
            ...options?.color,
        },
        ...options,
    };

    const hasColumns = loc.start && typeof loc.start.column === "number";

    const lines = normalizeLF(source)
        .split("\n")
        .map((ln) => ln.replaceAll("\t", "    "));

    const { start, end, markerLines } = getMarkerLines(loc, lines, config.linesAbove, config.linesBelow);

    const numberMaxWidth = String(end).length;

    const {
        message: colorizeMessage,
        marker: colorizeMarker,
        gutter: colorizeGutter,
    } = config.color as {
        gutter: ColorizeMethod;
        marker: ColorizeMethod;
        message: ColorizeMethod;
    };

    let frame = lines
        .slice(start, end)
        .map((line, index) => {
            const number = start + 1 + index;
            const hasMarker = markerLines[number];
            const paddedNumber = ` ${number}`.slice(-numberMaxWidth);
            const lastMarkerLine = !markerLines[number + 1];

            const gutter = ` ${paddedNumber}${config.showGutter ? ` |` : ""}`;

            if (hasMarker) {
                let markerLine = "";

                if (Array.isArray(hasMarker)) {
                    const markerSpacing = line.replace(/[^\t]/g, " ").slice(0, Math.max((hasMarker[0] as number) - 1, 0));
                    const numberOfMarkers = hasMarker[1] || 1;

                    markerLine = ["\n ", colorizeGutter(gutter.replace(/\d/g, " ")), " ", markerSpacing, colorizeMarker("^").repeat(numberOfMarkers)].join("");

                    if (lastMarkerLine && config?.message) {
                        markerLine += " " + colorizeMessage(config.message);
                    }
                }

                return [colorizeMarker(POINTER), colorizeGutter(gutter), line.length > 0 ? ` ${line}` : "", markerLine].join("");
            }

            return ` ${colorizeGutter(gutter)}${line.length > 0 ? ` ${line}` : ""}`;
        })
        .join("\n");

    if (config?.message && !hasColumns) {
        frame = `${" ".repeat(numberMaxWidth + 1)}${config.message}\n${frame}`;
    }

    return frame;
};

export type { CodeFrameOptions, CodeFrameNodeLocation, ColorizeMethod } from "../types";
