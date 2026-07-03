import { execFileSync, execSync } from "node:child_process";

const TRAILING_NEWLINE_REGEX = /\n$/;

/**
 * Return output of javascript file.
 */
export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node "${file}" ${flags.join(" ")}`;
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(TRAILING_NEWLINE_REGEX, "");
};

/**
 * Spawn `tsc --noEmit` against a fixture tsconfig so a broken dist/*.d.ts surfaces
 * as a failed test. Invokes typescript's JS entry directly via `process.execPath`
 * to avoid Windows' shell-required `.cmd` shim (CVE-2024-27980 / Node 20+).
 */
export const typeCheckFixture = (packageRoot: string, tsconfigRelative: string): { code: number; output: string } => {
    const tscJs = "node_modules/typescript/bin/tsc";

    try {
        execFileSync(process.execPath, [tscJs, "--noEmit", "-p", tsconfigRelative], {
            cwd: packageRoot,
            stdio: "pipe",
        });

        return { code: 0, output: "" };
    } catch (error) {
        const execError = error as { status?: number; stderr?: Buffer; stdout?: Buffer };
        const stdout = execError.stdout?.toString() ?? "";
        const stderr = execError.stderr?.toString() ?? "";

        return { code: execError.status ?? 1, output: `${stdout}${stderr}` };
    }
};
