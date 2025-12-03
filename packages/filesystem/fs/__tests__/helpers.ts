import { execSync } from "node:child_process";

/**
 * Return output of javascript file.
 */
// eslint-disable-next-line import/prefer-default-export
export const execScriptSync = (file: string, flags: string[] = []): string => {
    const cmd = `node "${file}" ${flags.join(" ")}`;
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};
