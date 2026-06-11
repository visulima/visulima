import { execFileSync, execSync } from "node:child_process";

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
const esc = (string_: string): string => string_.replaceAll("\u001B", String.raw`\x1b`);

const TRAILING_NEWLINE_REGEX = /\n$/;

// Color-forcing env vars that a test runner (nx, CI) injects into the ambient
// environment. They must be stripped from the child's inherited env, otherwise an
// ambient FORCE_COLOR leaks through cross-env and overrides the variable a test is
// actually exercising (e.g. it makes `NO_COLOR=1` a no-op). Each test re-adds the
// forcing var it needs via the `environment` argument, so stripping the inherited
// copy only removes runner noise — it never drops a value the test set on purpose.
const FORCING_COLOR_ENV_KEYS = ["FORCE_COLOR", "NO_COLOR", "CLICOLOR", "CLICOLOR_FORCE", "COLOR"];

/**
 * Return output of javascript file.
 */
const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const childEnvironment = { ...process.env };

    for (const key of FORCING_COLOR_ENV_KEYS) {
        delete childEnvironment[key];
    }

    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node "${file}" ${flags.join(" ")}`;
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(cmd, { env: childEnvironment });

    // replace last newline in result
    return result.toString().replace(TRAILING_NEWLINE_REGEX, "");
};

/**
 * Spawn `tsc --noEmit` against a fixture tsconfig so a broken dist/*.d.ts surfaces
 * as a failed test. Invokes the package's own `typescript` devDependency directly via
 * `node_modules/.bin/tsc` to avoid pnpm's auto-install lifecycle on stale lockfiles.
 */
const typeCheckFixture = (packageRoot: string, tsconfigRelative: string): { code: number; output: string } => {
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

export { esc, execScriptSync, typeCheckFixture };
