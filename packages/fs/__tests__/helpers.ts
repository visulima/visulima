import { execSync } from "node:child_process";

/**
 * Return output of javascript file.
 */
// eslint-disable-next-line import/prefer-default-export
export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node "${file}" ${flags.join(" ")}`;
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};
