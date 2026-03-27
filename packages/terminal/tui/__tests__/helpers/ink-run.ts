import process from "node:process";
import { createRequire } from "node:module";
import path from "node:path";
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

type Run = (fixture: string, props?: { env?: Record<string, string>; columns?: number }) => Promise<string>;

export const run: Run = async (fixture, props) => {
    const spawn = getSpawn();

    const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        CI: "false",
        ...props?.env,
        NODE_NO_WARNINGS: "1",
    };

    return new Promise<string>((resolve, reject) => {
        const term = spawn("node", ["--import=tsx", path.join(fixturesDir, `${fixture}.tsx`)], {
            name: "xterm-color",
            cols: typeof props?.columns === "number" ? props.columns : 100,
            cwd: fixturesDir,
            env,
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

            reject(new Error(`Process exited with a non-zero code: ${exitCode}`));
        });
    });
};
