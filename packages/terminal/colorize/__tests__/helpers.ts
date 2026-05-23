import { execFileSync, execSync } from "node:child_process";

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
const esc = (string_: string): string => string_.replaceAll("\u001B", String.raw`\x1b`);

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

/**
 * Spawn `tsc --noEmit` against a fixture tsconfig so a broken dist/*.d.ts surfaces
 * as a failed test. Invokes the package's own `typescript` devDependency directly via
 * `node_modules/.bin/tsc` to avoid pnpm's auto-install lifecycle on stale lockfiles.
 */
const typeCheckFixture = (packageRoot: string, tsconfigRelative: string): { code: number; output: string } => {
    const tscBin = process.platform === "win32" ? "node_modules/.bin/tsc.cmd" : "node_modules/.bin/tsc";

    try {
        execFileSync(tscBin, ["--noEmit", "-p", tsconfigRelative], {
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

export { esc, execScriptSync, typeCheckFixture };
