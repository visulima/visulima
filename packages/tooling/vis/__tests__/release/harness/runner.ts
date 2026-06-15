/**
 * E2E harness for `vis release` against fixture monorepos (RFC §19.3).
 *
 * Spins up verdaccio + copies a fixture to a temp dir + runs the requested
 * `vis release …` invocation against it. Returns structured output for
 * vitest assertions.
 *
 * **Status: scaffold only.** Requires `verdaccio` and (optionally) `msw` as
 * vis devDependencies, neither of which is currently present. Activation:
 *
 *   pnpm add -D --filter \@visulima/vis verdaccio
 *
 * Then drop the `\@ts-expect-error verdaccio not installed` comments and
 * the dynamic-import fallbacks below.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RunFixtureOptions {
    /** Path to the fixture (relative to __tests__/release/fixtures/). */
    fixture: string;
    /** Verdaccio port. Default 4873. */
    registryPort?: number;
    /** vis CLI path — defaults to the local build. */
    visBin?: string;
}

export interface RunFixtureResult {
    /** Verdaccio kill function. */
    cleanup: () => Promise<void>;
    /** Temp dir where the fixture was copied. Caller cleans up. */
    cwd: string;
    /** Full registry URL (with port). */
    registry: string;
    /** Helper to invoke `vis release …` against the temp fixture. */
    runVisRelease: (args: string[]) => { exitCode: number; stderr: string; stdout: string };
}

/**
 * Prepare a fixture for e2e testing.
 *
 *   1. Copy to a temp dir.
 *   2. `git init` so vis release commands have a repo.
 *   3. (TODO) Spin up verdaccio.
 */
export const prepareFixture = async (options: RunFixtureOptions): Promise<RunFixtureResult> => {
    const fixtureSource = join(__dirname, "..", "fixtures", options.fixture);
    const cwd = mkdtempSync(join(tmpdir(), "vis-e2e-"));

    cpSync(fixtureSource, cwd, { recursive: true });

    // git init so commit/tag work
    execFileSync("git", ["init", "-q"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    const registryPort = options.registryPort ?? 4873;
    const registry = `http://localhost:${registryPort}/`;

    // TODO: once verdaccio is a dep, replace this no-op with:
    //   const verdaccio = await import("verdaccio");
    //   const server = await verdaccio.runServer({ ... });
    //   await new Promise(r => server.listen(registryPort, r));
    const cleanup = async (): Promise<void> => {
        // TODO: server.close()
    };

    const visBin = options.visBin ?? join(__dirname, "..", "..", "..", "dist", "bin.js");

    const runVisRelease = (args: string[]): { exitCode: number; stderr: string; stdout: string } => {
        try {
            const result = execFileSync(process.execPath, [visBin, "release", ...args], {
                cwd,
                encoding: "utf8",
                env: { ...process.env, npm_config_registry: registry },
            });

            return { exitCode: 0, stderr: "", stdout: result };
        } catch (error_) {
            const error = error_ as { status?: number; stderr?: string; stdout?: string };

            return {
                exitCode: error.status ?? 1,
                stderr: error.stderr ?? "",
                stdout: error.stdout ?? "",
            };
        }
    };

    return { cleanup, cwd, registry, runVisRelease };
};
