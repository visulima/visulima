/**
 * This is a modified copy of the codeFrameColumns function from Babel
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/src/index.ts#L145-L217
 *
 * MIT License
 *
 * Copyright (c) 2014-present Sebastian McKenzie and other contributors
 */

import normalizeLF from "../util/normalize-lf";
import process from "../util/process";
import getMarkerLines from "./get-marker-lines";
import type { CodeFrameNodeLocation, CodeFrameOptions } from "./types";

export const CODE_FRAME_POINTER = process.platform === "win32" && !process.env?.WT_SESSION ? ">" : "❯";

/** Generate a code frame from string and an error location */
export const codeFrame = (
    source: string,
    loc: CodeFrameNodeLocation,
    options?: CodeFrameOptions,

): string => {
    const config = {
        // grab 2 lines before, and 3 lines after focused line
        linesAbove: 2,
        linesBelow: 3,
        prefix: "",
        showGutter: true,
        showLineNumbers: true,
        tabWidth: 4,
        ...options,
        color: {
            gutter: (value: string) => value,
            marker: (value: string) => value,
            message: (value: string) => value,
            ...options?.color,
        },
    };

    const hasColumns = loc.start && typeof loc.start.column === "number";

    let lines = normalizeLF(source).split("\n");

    if (typeof config?.tabWidth === "number") {
        lines = lines.map((ln) => ln.replaceAll("\t", " ".repeat(config.tabWidth as number)));
    }

    const { end, markerLines, start } = getMarkerLines(loc, lines, config.linesAbove, config.linesBelow);

    const numberMaxWidth = String(end).length;
    const { gutter: colorizeGutter, marker: colorizeMarker, message: colorizeMessage } = config.color;

    let frame = lines
        .slice(start, end)
        .map((line, index) => {
            const number = start + 1 + index;
            // eslint-disable-next-line security/detect-object-injection
            const hasMarker = markerLines[number];

            const paddedNumber = ` ${number}`.slice(-numberMaxWidth);
            const lastMarkerLine = !markerLines[number + 1];

            const gutter = ` ${paddedNumber}${config.showGutter ? " |" : ""}`;

            if (hasMarker) {
                let markerLine = "";

                if (Array.isArray(hasMarker)) {
                    const markerSpacing = line.replaceAll(/[^\t]/g, " ").slice(0, Math.max((hasMarker[0] as number) - 1, 0));

                    const numberOfMarkers = hasMarker[1] || 1;

                    markerLine = [
                        "\n ",
                        config.prefix + colorizeGutter(gutter.replaceAll(/\d/g, " ")),
                        " ",
                        markerSpacing,
                        colorizeMarker("^").repeat(numberOfMarkers),
                    ].join("");

                    if (lastMarkerLine && config.message) {
                        markerLine += ` ${colorizeMessage(config.message)}`;
                    }
                }

                return [config.prefix + colorizeMarker(CODE_FRAME_POINTER), colorizeGutter(gutter), line.length > 0 ? ` ${line}` : "", markerLine].join("");
            }

            return `${config.prefix} ${colorizeGutter(gutter)}${line.length > 0 ? ` ${line}` : ""}`;
        })
        .join("\n");

    if (config.message && !hasColumns) {
        frame = `${config.prefix + " ".repeat(numberMaxWidth + 1) + config.message}\n${frame}`;
    }

    return frame;
};

export type { CodeFrameLocation, CodeFrameNodeLocation, CodeFrameOptions, ColorizeMethod } from "./types";
