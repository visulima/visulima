import { Socket } from "node:net";

/**
 * Check if a port is available on a host
 * Works across environments with polyfills
 * @param host The hostname or IP address to check
 * @param port The port number to check
 * @returns Promise that resolves to true if the port is available, false otherwise
 */
const isPortAvailable = (host: string, port: number): Promise<boolean> =>
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

export default isPortAvailable;
