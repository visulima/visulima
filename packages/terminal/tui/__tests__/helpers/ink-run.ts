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

type Run = (fixture: string, props?: { columns?: number; env?: Record<string, string> }) => Promise<string>;

// eslint-disable-next-line import/prefer-default-export
export const run: Run = async (fixture, props) => {
    const spawn = getSpawn();

    const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        CI: "false",
        ...props?.env,
        NODE_NO_WARNINGS: "1",
    };

    return new Promise<string>((resolve, reject) => {
        const term = spawn("node", ["--import=tsx", path.join(fixturesDirectory, `${fixture}.tsx`)], {
            cols: typeof props?.columns === "number" ? props.columns : 100,
            cwd: fixturesDirectory,
            env,
            name: "xterm-color",
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
