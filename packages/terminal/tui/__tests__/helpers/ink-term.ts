import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import url from "node:url";

const require = createRequire(import.meta.url);

const fixturesDir = url.fileURLToPath(new URL("../ink/fixtures", import.meta.url));

// Lazy-load node-pty so that importing this helper does not fail on platforms
// where the native module hasn't been compiled (e.g. Linux without build tools).
const getSpawn = (): (typeof import("node-pty"))["spawn"] => {
    try {
        return (require("node-pty") as typeof import("node-pty")).spawn;
    } catch {
        throw new Error("node-pty is not available on this platform — PTY-based tests cannot run");
    }
};

const term = (fixture: string, args: string[] = []) => {
    const spawn = getSpawn();

    let resolve: (value?: any) => void;
    let reject: (error?: Error) => void;

    const exitPromise = new Promise((resolve2, reject2) => {
        resolve = resolve2;
        reject = reject2;
    });

    let readyResolve: () => void;
    const readyPromise = new Promise<void>((r) => {
        readyResolve = r;
    });

    const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        CI: "false",
        NODE_NO_WARNINGS: "1",
    };

    const ps = spawn("node", ["--import=tsx", path.join(fixturesDir, `${fixture}.tsx`), ...args], {
        cols: 100,
        cwd: fixturesDir,
        env,
        name: "xterm-color",
    });

    const result = {
        output: "",
        waitForExit: async () => exitPromise,
        write(input: string) {
            void readyPromise.then(() => {
                ps.write(input);
            });
        },
    };

    ps.onData((data) => {
        result.output += data;

        if (result.output.includes("__READY__")) {
            readyResolve();
        }
    });

    ps.onExit(({ exitCode }) => {
        if (exitCode === 0) {
            resolve();

            return;
        }

        reject(new Error(`Process exited with non-zero exit code: ${exitCode}`));
    });

    return result;
};

export default term;
