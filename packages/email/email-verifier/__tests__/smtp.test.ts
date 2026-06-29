import type { AddressInfo, Server } from "node:net";
import { createServer } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

// Force the MX lookup to resolve to our local mock server; the SMTP port is
// supplied per call via the `port` option.
vi.mock(import("../src/checks/mx"), () => {
    return {
        checkMxRecords: vi.fn<
            () => Promise<{ domainResolves: boolean; records: { exchange: string; priority: number }[]; resolvedVia: string; valid: boolean }>
        >(() =>
            Promise.resolve({
                domainResolves: true,
                records: [{ exchange: "127.0.0.1", priority: 10 }],
                resolvedVia: "mx",
                valid: true,
            }),
        ),
    };
});

// eslint-disable-next-line import/first
import { verifySmtp } from "../src/checks/smtp";

const LINE_SPLIT_REGEX = /\r?\n/;

/**
 * A reply for a single RCPT TO, chosen by recipient and (1-based) connection count.
 */
type RcptResponder = (recipient: string, connectionCount: number) => string;

const startMockSmtp = async (rcpt: RcptResponder): Promise<{ port: number; server: Server }> => {
    let connectionCount = 0;

    const server = createServer((socket) => {
        connectionCount += 1;
        const thisConnection = connectionCount;

        socket.write("220 mock ESMTP ready\r\n");

        socket.on("data", (data) => {
            for (const rawLine of data.toString().split(LINE_SPLIT_REGEX)) {
                const line = rawLine.trim();

                if (line.length === 0) {
                    continue;
                }

                if (line.startsWith("EHLO")) {
                    // Multi-line reply exercises the reply parser.
                    socket.write("250-mock greets you\r\n250 OK\r\n");
                } else if (line.startsWith("HELO") || line.startsWith("MAIL FROM")) {
                    socket.write("250 OK\r\n");
                } else if (line.startsWith("RCPT TO")) {
                    const recipient = line.slice(line.indexOf("<") + 1, line.lastIndexOf(">"));

                    socket.write(`${rcpt(recipient, thisConnection)}\r\n`);
                } else if (line.startsWith("QUIT")) {
                    socket.write("221 Bye\r\n");
                    socket.end();
                }
            }
        });
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve();
        });
    });

    return { port: (server.address() as AddressInfo).port, server };
};

describe.skipIf(process.platform !== "linux")("verifySmtp (mock server)", () => {
    let active: Server | undefined;

    afterEach(async () => {
        if (active) {
            await new Promise<void>((resolve) => {
                active?.close(() => {
                    resolve();
                });
            });
            active = undefined;
        }
    });

    it("verifies a real mailbox and reports not-catch-all", async () => {
        expect.assertions(3);

        const { port, server } = await startMockSmtp((recipient) => {
            if (recipient.startsWith("verify")) {
                return "250 OK";
            }

            return recipient.length > 25 ? "550 No such user" : "250 OK";
        });

        active = server;

        const result = await verifySmtp("real@example.com", { port, retries: 0, timeout: 2000 });

        expect(result.valid).toBe(true);
        expect(result.acceptAll).toBe(false);
        expect(result.code).toBe(250);
    });

    it("detects a catch-all server (random recipient also accepted)", async () => {
        expect.assertions(2);

        const { port, server } = await startMockSmtp(() => "250 OK");

        active = server;

        const result = await verifySmtp("anyone@example.com", { catchAllProbes: 1, port, retries: 0, timeout: 2000 });

        expect(result.valid).toBe(true);
        expect(result.acceptAll).toBe(true);
    });

    it("flags a full mailbox on 452", async () => {
        expect.assertions(2);

        const { port, server } = await startMockSmtp((recipient) => {
            if (recipient.startsWith("full")) {
                return "452 4.2.2 Mailbox full";
            }

            return "250 OK";
        });

        active = server;

        const result = await verifySmtp("full@example.com", { port, retries: 0, timeout: 2000 });

        expect(result.mailboxFull).toBe(true);
        expect(result.valid).toBe(false);
    });

    it("treats a 550 as a permanent, non-deferred rejection", async () => {
        expect.assertions(3);

        const { port, server } = await startMockSmtp(() => "550 5.1.1 No such user");

        active = server;

        const result = await verifySmtp("ghost@example.com", { port, retries: 0, timeout: 2000 });

        expect(result.valid).toBe(false);
        expect(result.deferred).toBeUndefined();
        expect(result.code).toBe(550);
    });

    it("retries past a transient greylist (451 then 250)", async () => {
        expect.assertions(1);

        const { port, server } = await startMockSmtp((_recipient, connectionCount) => {
            if (connectionCount === 1) {
                return "451 4.7.1 Greylisted, try later";
            }

            return "250 OK";
        });

        active = server;

        const result = await verifySmtp("grey@example.com", { catchAllProbes: 0, port, retries: 1, retryDelay: 50, timeout: 2000 });

        expect(result.valid).toBe(true);
    });
});
