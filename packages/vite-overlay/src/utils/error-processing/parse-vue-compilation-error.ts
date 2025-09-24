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

    const positionPattern = /\((\d+):(\d+)\)/;
    const positionMatch = errorMessage.match(positionPattern);

    if (positionMatch && positionMatch[1] && positionMatch[2]) {
        line = Number.parseInt(positionMatch[1], 10);
        column = Number.parseInt(positionMatch[2], 10);
    }

    // eslint-disable-next-line sonarjs/slow-regex
    const filePathPattern = /(\S+\.vue)/;
    const fileMatch = errorMessage.match(filePathPattern);

    if (fileMatch && fileMatch[1]) {
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
