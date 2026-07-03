/* eslint-disable sonarjs/prefer-regexp-exec, @typescript-eslint/prefer-nullish-coalescing */
const VUE_POSITION_RE = /\((\d+):(\d+)\)/;
// eslint-disable-next-line sonarjs/slow-regex
const VUE_FILE_PATH_RE = /(\S+\.vue)/;

/**
 * Parses Vue SFC compilation error messages to extract file, line, and column information.
 * @param errorMessage The Vue compilation error message to parse
 * @returns Object containing parsed error information or null if not a Vue error
 */
const parseVueCompilationError = (errorMessage: string): { column: number; line: number; message: string; originalFilePath: string } | undefined => {
    if (!errorMessage.includes("[vue/compiler-sfc]")) {
        return undefined;
    }

    let filePath = "";
    let line = 0;
    let column = 0;

    const positionMatch = errorMessage.match(VUE_POSITION_RE);

    if (positionMatch?.[1] && positionMatch[2]) {
        line = Number.parseInt(positionMatch[1], 10);
        column = Number.parseInt(positionMatch[2], 10);
    }

    const fileMatch = errorMessage.match(VUE_FILE_PATH_RE);

    if (fileMatch?.[1]) {
        filePath = fileMatch[1] || "";
    }

    const message = errorMessage.split("\n")[0] || errorMessage;

    if (filePath && line > 0 && column > 0) {
        return {
            column,
            line,
            message,
            originalFilePath: filePath,
        };
    }

    return undefined;
};

export default parseVueCompilationError;
