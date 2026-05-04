import { createServer, type Server } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runReadiness, ServiceReadinessError, waitForTcp } from "../../src/services/readiness";

const listen = (server: Server, port = 0): Promise<number> =>
    new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
            const address = server.address();

            if (typeof address === "object" && address !== null) {
                resolve(address.port);
                return;
            }

            reject(new Error("Server bound without an address"));
        });
    });

const close = (server: Server): Promise<void> =>
    new Promise((resolve) => {
        server.close(() => resolve());
    });

describe(waitForTcp, () => {
    let server: Server | undefined;

    beforeEach(() => {
        server = undefined;
    });

    afterEach(async () => {
        if (server && server.listening) {
            await close(server);
        }
    });

    it("resolves once the port accepts connections", async () => {
        expect.assertions(1);

        server = createServer();
        const port = await listen(server);

        await expect(waitForTcp({ port, timeoutMs: 2000 })).resolves.toBeUndefined();
    });

    it("throws ServiceReadinessError when nothing listens within the timeout", async () => {
        expect.assertions(2);

        // Pick a port that has nothing on it. 1 (tcpmux) is reserved on
        // most systems, but we need a definitely-unbound port — bind to 0
        // briefly to discover one, close, then probe.
        const probe = createServer();
        const freePort = await listen(probe);
        await close(probe);

        try {
            await waitForTcp({ port: freePort, timeoutMs: 500 });
        } catch (error) {
            expect(error).toBeInstanceOf(ServiceReadinessError);
            expect((error as ServiceReadinessError).elapsedMs).toBeGreaterThanOrEqual(450);
        }
    });
});

describe(runReadiness, () => {
    let server: Server | undefined;

    afterEach(async () => {
        if (server && server.listening) {
            await close(server);
        }
    });

    it("uses the explicit readiness probe when set", async () => {
        expect.assertions(1);

        server = createServer();
        const port = await listen(server);

        await expect(runReadiness({ readiness: { tcp: { port, timeoutMs: 2000 } } })).resolves.toBeUndefined();
    });

    it("falls back to config.port when no readiness block is set", async () => {
        expect.assertions(1);

        server = createServer();
        const port = await listen(server);

        await expect(runReadiness({ port }, { timeoutMs: 2000 })).resolves.toBeUndefined();
    });

    it("resolves immediately when neither readiness nor port is set", async () => {
        expect.assertions(1);
        await expect(runReadiness({})).resolves.toBeUndefined();
    });
});
