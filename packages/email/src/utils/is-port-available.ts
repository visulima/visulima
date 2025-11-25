import { Socket } from "node:net";

/**
 * Check if a port is available on a host
 * Works across environments with polyfills
 */
export const isPortAvailable = (host: string, port: number): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
        const socket = new Socket();

        const onError = (): void => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(1000);
        socket.on("error", onError);
        socket.on("timeout", onError);

        socket.connect(port, host, () => {
            socket.end();
            resolve(true);
        });
    });
