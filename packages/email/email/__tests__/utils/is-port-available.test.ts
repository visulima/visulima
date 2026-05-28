import type { AddressInfo } from "node:net";
import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import isPortAvailable from "../../src/utils/is-port-available";

interface ListeningServer {
    close: () => Promise<void>;
    port: number;
}

const startServer = async (): Promise<ListeningServer> =>
    new Promise<ListeningServer>((resolve) => {
        const server = createServer();

        server.listen(0, "127.0.0.1", () => {
            const address = server.address() as AddressInfo;

            resolve({
                close: async (): Promise<void> =>
                    new Promise<void>((_resolve) => {
                        server.close(() => {
                            _resolve();
                        });
                    }),
                port: address.port,
            });
        });
    });

describe(isPortAvailable, () => {
    it("resolves true when a server accepts the connection", async () => {
        expect.assertions(1);

        const server = await startServer();

        try {
            await expect(isPortAvailable("127.0.0.1", server.port)).resolves.toBe(true);
        } finally {
            await server.close();
        }
    });

    it("resolves false when the connection is refused", async () => {
        expect.assertions(1);

        const server = await startServer();
        const { port } = server;

        await server.close();

        await expect(isPortAvailable("127.0.0.1", port)).resolves.toBe(false);
    });
});
