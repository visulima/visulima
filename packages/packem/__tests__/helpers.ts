import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/prefer-default-export
export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";

    let cmd = `node "${file}" ${flags.join(" ")}`;

    if (environmentVariables) {
        cmd = `${environmentVariables}${cmd}`;
    }

    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};

export const execPackemSync = (flags: string[] = [], environment: string[] = []) => {
    return execScriptSync(join(dirname(fileURLToPath(import.meta.url)), "../dist/cli.mjs"), flags, environment);
}
