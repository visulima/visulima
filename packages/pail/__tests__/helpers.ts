import { execSync } from "node:child_process";

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
export const esc = (string_: string): string => string_.replaceAll("", "\\x1b");

export const execScriptSync = async (file: string, flags: string[] = [], environment: string[] = [], crossEnvironment = false): Promise<string> => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";

    let cmd = `node "${file}"${flags.length > 0 ? " " + flags.join(" ") : ""}`;

    if (environmentVariables) {
        cmd = (crossEnvironment ? "cross-env " : "") + `${environmentVariables}${cmd}`;
    }

    const result = execSync(cmd, { encoding: "buffer" });
    console.log({ result }, result.length);
    // replace last newline in result
    return result.toString("utf8").replace(/\n$/, "");
};
