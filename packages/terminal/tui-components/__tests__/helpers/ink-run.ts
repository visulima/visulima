import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import url from "node:url";

const require = createRequire(import.meta.url);

const fixturesDirectory = url.fileURLToPath(new URL("../ink/fixtures", import.meta.url));

// Lazy-load node-pty so that importing this helper does not fail on platforms
// where the native module hasn't been compiled (e.g. Linux without build tools).
const getSpawn = (): (typeof import("node-pty"))["spawn"] => {
    try {
        return (require("node-pty") as typeof import("node-pty")).spawn;
    } catch {
        throw new Error("node-pty is not available on this platform — PTY-based tests cannot run");
    }
};

// Require-success isn't enough on macOS-15 GitHub-hosted runners: node-pty
// loads but the native UnixTerminal constructor throws "posix_spawnp failed"
// when the test actually tries to spawn. Smoke-test an actual spawn here so
// every PTY-based test file can guard with `it.skipIf(!ptyAvailable)` and
// the suite passes on hosts where PTY allocation is broken.
//
// Windows GitHub-hosted runners hit a separate failure: the conpty cleanup
// agent (`conpty_console_list_agent.js`) calls `AttachConsole` in a spawned
// child, which the runner session denies — and that error crashes the test
// runner process even when the parent probe succeeds. Skip outright on win32
// so the suite stays green; local Windows developers with working conpty can
// flip this off locally if they want to exercise PTY paths.
export const ptyAvailable: boolean = (() => {
    if (process.platform === "win32") {
        return false;
    }

    try {
        const probeSpawn = getSpawn();
        const probe = probeSpawn("/bin/sh", ["-c", "exit 0"], {
            cols: 80,
            cwd: fixturesDirectory,
            env: process.env,
            name: "xterm-color",
            rows: 24,
        });

        probe.kill();

        return true;
    } catch {
        return false;
    }
})();

type Run = (fixture: string, props?: { args?: string[]; columns?: number; env?: Record<string, string>; rows?: number }) => Promise<string>;

export const run: Run = async (fixture, props) => {
    const spawn = getSpawn();

    const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        CI: "false",
        ...props?.env,
        NODE_NO_WARNINGS: "1",
    };

    return new Promise<string>((resolve, reject) => {
        const term = spawn("node", ["--import=tsx", path.join(fixturesDirectory, `${fixture}.tsx`), ...(props?.args ?? [])], {
            cols: typeof props?.columns === "number" ? props.columns : 100,
            cwd: fixturesDirectory,
            env,
            name: "xterm-color",
            rows: typeof props?.rows === "number" ? props.rows : 24,
        });

        let output = "";

        term.onData((data) => {
            output += data;
        });

        term.onExit(({ exitCode }) => {
            if (exitCode === 0) {
                resolve(output);

                return;
            }

            reject(new Error(`Process exited with a non-zero code: ${String(exitCode)}`));
        });
    });
};
