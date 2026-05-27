import { execFile } from "node:child_process";

import type { Command } from "@visulima/cerebro";

import { resolveCacheDirectory } from "../cache/cache-directory";
import { startDashboardServer } from "../dashboard/server";
import { pail } from "../io/logger";

const openInBrowser = (url: string): void => {
    const { platform } = process;
    const [binary, args]
        = platform === "darwin"
            ? (["open", [url]] as const)
            : platform === "win32"
                ? (["cmd", ["/c", "start", "", url]] as const)
                : (["xdg-open", [url]] as const);

    execFile(binary, args, (error) => {
        if (error) {
            // Best effort — the URL is already printed to stderr.
        }
    });
};

const dashboard: Command = {
    description: "Open a browser dashboard with cache, run history, and cache-miss diffs",
    examples: [
        ["vis dashboard", "Start the dashboard on a random port (server only — does not open a browser)"],
        ["vis dashboard --open", "Start the dashboard and open it in the default browser"],
        ["vis dashboard --port=7788", "Pin the server to a specific port"],
        ["vis dashboard --host=0.0.0.0 --port=7788", "Expose the dashboard on all interfaces"],
    ],
    execute: async ({ options, process: proc, visConfig, workspaceRoot: wsRoot }) => {
        const workspaceRoot = wsRoot ?? proc.cwd;

        const cacheDirectory = resolveCacheDirectory(workspaceRoot, options.cacheDir as string | undefined, visConfig?.taskRunner?.cacheDirectory);

        const port = typeof options.port === "number" && Number.isFinite(options.port) ? options.port : 0;
        const host = typeof options.host === "string" && options.host.length > 0 ? options.host : "127.0.0.1";

        const server = await startDashboardServer({
            cacheDirectory,
            host,
            port,
            workspaceRoot,
        });

        pail.success(`Dashboard listening on ${server.url}`);
        pail.info(`Workspace: ${workspaceRoot}`);
        pail.info(`Cache:     ${cacheDirectory}`);
        pail.info("Press Ctrl+C to stop.");

        if (options.open === true) {
            openInBrowser(server.url);
        }

        await new Promise<void>((resolve) => {
            let shuttingDown = false;
            const shutdown = (): void => {
                if (shuttingDown) {
                    return;
                }

                shuttingDown = true;
                process.off("SIGINT", shutdown);
                process.off("SIGTERM", shutdown);
                // eslint-disable-next-line no-void -- intentional fire-and-forget; satisfies @typescript-eslint/no-floating-promises.
                void (async () => {
                    try {
                        await server.close();
                    } catch {
                        // Best effort during shutdown — swallow so the second signal can't escape as an unhandled rejection.
                    } finally {
                        resolve();
                    }
                })();
            };

            process.once("SIGINT", shutdown);
            process.once("SIGTERM", shutdown);
        });
    },
    group: "Workspace",
    name: "dashboard",
    options: [
        {
            defaultValue: 0,
            description: "Port to bind the dashboard server to (0 = auto-assign)",
            name: "port",
            type: Number,
        },
        {
            defaultValue: "127.0.0.1",
            description: "Host interface to bind to. Default binds to localhost only.",
            name: "host",
            type: String,
        },
        {
            defaultValue: false,
            description: "Open the dashboard in the default browser after starting",
            name: "open",
            type: Boolean,
        },
        {
            description: "Cache directory to inspect (overrides config and default). Relative paths resolve against the workspace root.",
            name: "cache-dir",
            type: String,
        },
    ],
};

export default dashboard;
