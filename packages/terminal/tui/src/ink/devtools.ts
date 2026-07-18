/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, no-console */
import "./devtools-window-polyfill";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import devtools from "react-devtools-core";

const isDevToolsReachable = async (): Promise<boolean> =>
    new Promise((resolve) => {
        // Native WebSocket (global since Node 22); no `ws` dependency needed.
        const socket = new WebSocket("ws://localhost:8097");

        const timeout = setTimeout(() => {
            socket.close();
            resolve(false);
        }, 2000);

        // Don't let the timeout keep the process alive on its own
        timeout.unref();

        socket.addEventListener("open", () => {
            clearTimeout(timeout);
            socket.close();
            resolve(true);
        });

        // Do NOT call close() on an errored socket: on Node 22's bundled undici
        // that triggers a recursive error. Just resolve — the socket is dead.
        socket.addEventListener("error", () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });

if (await isDevToolsReachable()) {
    (devtools as any).initialize();

    (devtools as any).connectToDevTools();
} else {
    console.warn("DEV is set to true, but the React DevTools server is not running. Start it with:\n\n$ npx react-devtools\n");
}
