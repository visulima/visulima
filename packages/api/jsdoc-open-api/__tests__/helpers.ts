import { execFileSync, execSync, spawnSync } from "node:child_process";

const TRAILING_NEWLINE_RE = /\n$/;

/**
 * Return output of javascript file.
 */
export const execScriptSync = (file: string, flags: string[] = []): string => {
    const cmd = `node "${file}" ${flags.join(" ")}`;
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(cmd);

    return result.toString().replace(TRAILING_NEWLINE_RE, "");
};

/**
 * Spawn `tsc --noEmit` against a fixture tsconfig so a broken dist/*.d.ts surfaces
 * as a failed test. Invokes the package's own `typescript` devDependency directly via
 * `node_modules/.bin/tsc` to avoid pnpm's auto-install lifecycle on stale lockfiles.
 */
export const typeCheckFixture = (packageRoot: string, tsconfigRelative: string): { code: number; output: string } => {
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

export interface BinResult {
    code: number;
    stderr: string;
    stdout: string;
}

/**
 * Spawn a bin script with the current node and capture stdout/stderr/exit code.
 * Pipes empty stdin so stdio-based servers exit immediately on EOF.
 */
export const execBin = (binPath: string, args: string[] = [], options: { cwd?: string; timeout?: number } = {}): BinResult => {
    const result = spawnSync(process.execPath, [binPath, ...args], {
        cwd: options.cwd,
        encoding: "utf8",
        input: "",
        timeout: options.timeout ?? 15_000,
    });

    return {
        code: result.status ?? -1,
        stderr: result.stderr.replace(TRAILING_NEWLINE_RE, ""),
        stdout: result.stdout.replace(TRAILING_NEWLINE_RE, ""),
    };
};
