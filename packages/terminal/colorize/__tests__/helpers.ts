import { execSync } from "node:child_process";

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
const esc = (string_: string): string => string_.replaceAll("", String.raw`\x1b`);

const TRAILING_NEWLINE_REGEX = /\n$/;

/**
 * Return output of javascript file.
 */
const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node "${file}" ${flags.join(" ")}`;
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(TRAILING_NEWLINE_REGEX, "");
};

export { esc, execScriptSync };
