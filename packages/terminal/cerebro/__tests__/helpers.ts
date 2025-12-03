import { execSync } from "node:child_process";

/**
 * Return output of javascript file.
 */
export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const terminalWidth = process.env.CEREBRO_TERMINAL_WIDTH ?? "80";
    const defaultEnv = [`CEREBRO_TERMINAL_WIDTH=${terminalWidth}`];
    const allEnv = [...defaultEnv, ...environment];
    const environmentVariables = allEnv.length > 0 ? `${allEnv.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node "${file}" ${flags.join(" ")}`;
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
export const esc = (string_: string): string => string_.replaceAll("", String.raw`\x1b`);
