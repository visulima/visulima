/* eslint-disable jsdoc/lines-before-block, no-secrets/no-secrets */
/**
 * This is a copy of the codeFrame function from Babel
 * @see https://github.com/babel/babel/blob/85e649203b61b7c908eb04c05511a0d35f893e8e/packages/babel-code-frame/src/index.ts#L68-L143
 *
 * MIT License
 *
 * Copyright (c) 2014-present Sebastian McKenzie and other contributors
 */

/**
 * Extract what lines should be marked and highlighted.
 */
import type { CodeFrameLocation, CodeFrameNodeLocation } from "./types";

type MarkerLines = Record<number, true | [number | undefined, number | undefined]>;

const getMarkerLines = (
    loc: CodeFrameNodeLocation,
    source: string[],
    linesAbove: number,
    linesBelow: number,
): {
    end: number;
    markerLines: MarkerLines;
    start: number;
} => {
    const startLoc: CodeFrameLocation = {
        column: 0,
        // @ts-expect-error Can be overwritten
        line: -1,
        ...loc.start,
    };
    const endLoc: CodeFrameLocation = {
        ...startLoc,
        ...loc.end,
    };
    const startLine = startLoc.line;
    const startColumn = startLoc.column;
    const endLine = endLoc.line;
    const endColumn = endLoc.column;

    let start = Math.max(startLine - (linesAbove + 1), 0);
    let end = Math.min(source.length, endLine + linesBelow);

    if (startLine === -1) {
        start = 0;
    }

    if (endLine === -1) {
        end = source.length;
    }

    const lineDiff = endLine - startLine;
    const markerLines: MarkerLines = {};

    if (lineDiff) {
        // eslint-disable-next-line no-plusplus
        for (let index = 0; index <= lineDiff; index++) {
            const lineNumber = index + startLine;

            if (!startColumn) {
                markerLines[lineNumber] = true;
            } else if (index === 0) {
                const sourceLength = source[lineNumber - 1]?.length;

                markerLines[lineNumber] = [startColumn, (sourceLength ?? 0) - startColumn + 1];
            } else if (index === lineDiff) {
                markerLines[lineNumber] = [0, endColumn];
            } else {
                const sourceLength = source[lineNumber - index]?.length;

                markerLines[lineNumber] = [0, sourceLength];
            }
        }
    } else if (startColumn === endColumn) {
        markerLines[startLine] = startColumn ? [startColumn, 0] : true;
    } else {
        markerLines[startLine] = [startColumn, (endColumn ?? 0) - (startColumn ?? 0)];
    }

    return { end, markerLines, start };
};

export default getMarkerLines;
