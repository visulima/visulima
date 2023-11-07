import { env, platform } from "node:process";

import type { CodeFrameOptions, ErrorLocation } from "./types";
import { normalizeLF } from "./utils";

const POINTER = platform === "win32" && !env["WT_SESSION"] ? ">" : "❯";

/** Generate a code frame from string and an error location */
const codeFrame = (
    source: string,
    loc: ErrorLocation,
    options?: CodeFrameOptions,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string => {
    if (loc.line === undefined || loc.column === undefined) {
        return "";
    }

    // grab 2 lines before, and 3 lines after focused line
    const config = {
        focusLineColor: (value: string) => value,
        linesAbove: 2,
        linesBelow: 3,
        ...options,
    };

    const lines = normalizeLF(source)
        .split("\n")
        .map((ln) => ln.replaceAll("\t", "  "));

    const visibleLines = [];

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let n = -(config.linesAbove + 1); n <= config.linesBelow; n++) {
        if (lines[loc.line + n]) {
            visibleLines.push(loc.line + n);
        }
    }

    // figure out gutter width
    let gutterWidth = 0;

    visibleLines.forEach((lineNo) => {
        const w = `${POINTER} ${lineNo}${lineNo < 9 ? " " : ""}`;

        if (w.length > gutterWidth) {
            gutterWidth = w.length;
        }
    });

    // print lines
    let output = "";

    visibleLines.forEach((lineNo) => {
        let code = "";
        const isFocusedLine = lineNo === (loc.line as number) - 1;

        code += isFocusedLine ? `${POINTER} ` : "  ";
        // eslint-disable-next-line security/detect-object-injection
        code += `${lineNo < 9 ? " " : ""}${lineNo + 1} | ${lines[lineNo]}\n`;

        if (isFocusedLine) {
            code += `${Array.from({ length: gutterWidth }).join(" ")}  | ${Array.from({
                length: loc.column as number,
            }).join(" ")}^`;
        }

        output += isFocusedLine ? `${config.focusLineColor(code)}\n` : code;
    });

    return output;
};

export default codeFrame;
