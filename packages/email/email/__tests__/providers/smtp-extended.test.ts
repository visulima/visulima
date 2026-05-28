import { Buffer } from "node:buffer";
import { generateKeyPairSync } from "node:crypto";
import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { smtpProvider } from "../../src/providers/smtp/index";
import type { SmtpEmailOptions } from "../../src/providers/smtp/types";
import isPortAvailable from "../../src/utils/is-port-available";

const mockNet = vi.hoisted(() => {
    return { createConnection: undefined as ((port: number, host: string) => unknown) | undefined };
});
const mockTls = vi.hoisted(() => {
    return { connect: undefined as ((options: { socket?: unknown }) => unknown) | undefined };
});

vi.mock(import("node:net"), () => {
    return {
        createConnection: (port: number, host: string) => {
            if (!mockNet.createConnection) {
                throw new Error("net.createConnection not configured");
            }

            return mockNet.createConnection(port, host);
        },
        Socket: class {},
    };
});

vi.mock(import("node:tls"), () => {
    return {
        connect: (options: { socket?: unknown }) => {
            if (!mockTls.connect) {
                throw new Error("tls.connect not configured");
            }

            return mockTls.connect(options);
        },
    };
});

vi.mock(import("../../src/utils/is-port-available"), () => {
    return {
        default: vi.fn(),
    };
});

const isPortAvailableMock = isPortAvailable as unknown as ReturnType<typeof vi.fn>;

interface FakeSocket extends EventEmitter {
    destroy: () => FakeSocket;
    destroyed: boolean;
    end: () => FakeSocket;
    write: (data: string) => boolean;
    writes: string[];
}

interface ServerConfig {
    authCode?: string;
    cramChallengeBad?: boolean;
    dataCode?: string;
    ehloCaps?: string[];
    errorCommand?: string;
    mailFromCode?: string;
    messageCode?: string;
    rcptCode?: string;
    silentCommand?: string;
    starttlsCode?: string;
}

interface Behavior {
    greeting?: string;
    net?: "error" | "greeting" | "silent" | "throw";
    netFailAfter?: number;
    tlsConnect?: "error" | "greeting" | "silent" | "throw";
    tlsUpgrade?: "error" | "secure" | "silent" | "throw";
}

type Responder = (raw: string) => string | undefined;

const DEFAULT_GREETING = "220 mail.example.com ESMTP ready\r\n";
const SOCKET_ERROR = "__SOCKET_ERROR__";

const baseEmail: SmtpEmailOptions = {
    from: { email: "sender@example.com" },
    html: "<h1>Test</h1>",
    subject: "Test",
    to: { email: "user@example.com" },
};

const { privateKey: dkimPrivateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
});

let createdSockets: FakeSocket[];
let tlsConnectArgs: { socket?: unknown }[];
let netConnectCount: number;

const buildEhlo = (caps: string[]): string => {
    const lines = ["mail.example.com", ...caps];

    return `${lines.map((line, index) => `250${index === lines.length - 1 ? " " : "-"}${line}`).join("\r\n")}\r\n`;
};

const makeServer = (config: ServerConfig = {}): Responder => {
    const ehlo = buildEhlo(config.ehloCaps ?? []);
    let authPhase: "cram" | "login-pass" | "login-user" | undefined;

    // eslint-disable-next-line sonarjs/cognitive-complexity
    return (raw: string): string | undefined => {
        if (raw.endsWith("\r\n.\r\n")) {
            return config.messageCode ?? "250 OK: queued as ABC123\r\n";
        }

        const command = raw.trim();

        if (config.silentCommand && command.startsWith(config.silentCommand)) {
            return undefined;
        }

        if (config.errorCommand && command.startsWith(config.errorCommand)) {
            return SOCKET_ERROR;
        }

        if (command.startsWith("EHLO")) {
            return ehlo;
        }

        if (command.startsWith("STARTTLS")) {
            return config.starttlsCode ?? "220 Go ahead\r\n";
        }

        if (command.startsWith("AUTH LOGIN")) {
            authPhase = "login-user";

            return "334 VXNlcm5hbWU6\r\n";
        }

        if (command.startsWith("AUTH CRAM-MD5")) {
            authPhase = "cram";

            if (config.cramChallengeBad) {
                return "334  \r\n";
            }

            return `334 ${Buffer.from("<12345.67@mail.example.com>").toString("base64")}\r\n`;
        }

        if (command.startsWith("AUTH PLAIN")) {
            return config.authCode ?? "235 Authentication successful\r\n";
        }

        if (command.startsWith("AUTH XOAUTH2")) {
            return config.authCode ?? "235 Authentication successful\r\n";
        }

        if (command.startsWith("MAIL FROM")) {
            return config.mailFromCode ?? "250 OK\r\n";
        }

        if (command.startsWith("RCPT TO")) {
            return config.rcptCode ?? "250 Accepted\r\n";
        }

        if (command.startsWith("DATA")) {
            return config.dataCode ?? "354 End data with <CR><LF>.<CR><LF>\r\n";
        }

        if (command.startsWith("QUIT")) {
            return "221 Bye\r\n";
        }

        if (command.startsWith("RSET")) {
            return "250 OK\r\n";
        }

        if (authPhase === "login-user") {
            authPhase = "login-pass";

            return "334 UGFzc3dvcmQ6\r\n";
        }

        if (authPhase === "login-pass") {
            authPhase = undefined;

            return config.authCode ?? "235 Authentication successful\r\n";
        }

        if (authPhase === "cram") {
            authPhase = undefined;

            return config.authCode ?? "235 Authentication successful\r\n";
        }

        return undefined;
    };
};

const createFakeSocket = (respond: Responder): FakeSocket => {
    // eslint-disable-next-line unicorn/prefer-event-target -- provider uses socket.on/.once/.removeListener which EventTarget does not support
    const socket = new EventEmitter() as FakeSocket;

    socket.destroyed = false;
    socket.writes = [];

    socket.write = (data: string): boolean => {
        socket.writes.push(data);

        const response = respond(data);

        if (response === SOCKET_ERROR) {
            queueMicrotask(() => {
                if (!socket.destroyed) {
                    socket.emit("error", new Error("command socket error"));
                }
            });

            return true;
        }

        if (response !== undefined) {
            queueMicrotask(() => {
                if (!socket.destroyed) {
                    socket.emit("data", Buffer.from(response));
                }
            });
        }

        return true;
    };

    socket.end = (): FakeSocket => {
        queueMicrotask(() => socket.emit("close"));

        return socket;
    };

    socket.destroy = (): FakeSocket => {
        socket.destroyed = true;

        return socket;
    };

    return socket;
};

const spawn = (config: ServerConfig, mode: "error" | "greeting" | "secure" | "silent", greeting: string): FakeSocket => {
    const socket = createFakeSocket(makeServer(config));

    createdSockets.push(socket);

    if (mode === "silent") {
        return socket;
    }

    queueMicrotask(() => {
        if (socket.destroyed) {
            return;
        }

        if (mode === "secure") {
            socket.emit("secure");
        } else if (mode === "error") {
            socket.emit("error", new Error("socket boom"));
        } else {
            socket.emit("data", Buffer.from(greeting));
        }
    });

    return socket;
};

const useServer = (config: ServerConfig = {}, behavior: Behavior = {}): void => {
    const greeting = behavior.greeting ?? DEFAULT_GREETING;
    const netMode = behavior.net ?? "greeting";
    const tlsUpgradeMode = behavior.tlsUpgrade ?? "secure";
    const tlsConnectMode = behavior.tlsConnect ?? "greeting";

    mockNet.createConnection = () => {
        netConnectCount += 1;

        const mode = behavior.netFailAfter !== undefined && netConnectCount > behavior.netFailAfter ? "error" : netMode;

        if (mode === "throw") {
            throw new Error("connect failed");
        }

        return spawn(config, mode, greeting);
    };

    mockTls.connect = (options) => {
        tlsConnectArgs.push(options);

        if (options.socket) {
            if (tlsUpgradeMode === "throw") {
                throw new Error("tls upgrade failed");
            }

            return spawn(config, tlsUpgradeMode, greeting);
        }

        if (tlsConnectMode === "throw") {
            throw new Error("tls connect failed");
        }

        return spawn(config, tlsConnectMode, greeting);
    };
};

const allWrites = (): string[] => createdSockets.flatMap((socket) => socket.writes);

const lastMessage = (): string => allWrites().find((write) => write.endsWith("\r\n.\r\n")) ?? "";

const plainConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    return { host: "smtp.example.com", port: 587, rejectUnauthorized: false, secure: false, ...overrides };
};

describe("smtp provider (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        createdSockets = [];
        tlsConnectArgs = [];
        netConnectCount = 0;

        isPortAvailableMock.mockResolvedValue(true);
        useServer();
    });

    describe("factory", () => {
        it("throws when the host is missing", () => {
            expect.assertions(1);

            expect(() => smtpProvider({} as any)).toThrow("Missing required option: 'host'");
        });
    });

    describe("isAvailable", () => {
        it("returns true when the port is open and the greeting is accepted", async () => {
            expect.assertions(1);

            const provider = smtpProvider(plainConfig());

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("returns false when the port is unavailable", async () => {
            expect.assertions(1);

            isPortAvailableMock.mockResolvedValue(false);

            const provider = smtpProvider(plainConfig());

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when the server greeting is not 220", async () => {
            expect.assertions(1);

            useServer({}, { greeting: "554 No service\r\n" });

            const provider = smtpProvider(plainConfig());

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when the connection times out", async () => {
            expect.assertions(1);

            useServer({}, { net: "silent" });

            const provider = smtpProvider(plainConfig({ timeout: 50 }));

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when the socket errors before the greeting", async () => {
            expect.assertions(1);

            useServer({}, { net: "error" });

            const provider = smtpProvider(plainConfig());

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("returns false when creating the connection throws", async () => {
            expect.assertions(1);

            useServer({}, { net: "throw" });

            const provider = smtpProvider(plainConfig());

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("defaults the port from the secure flag when none is given", async () => {
            expect.assertions(1);

            const provider = smtpProvider({ host: "smtp.example.com" });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });
    });

    describe("initialize", () => {
        it("only checks availability once across repeated calls", async () => {
            expect.assertions(1);

            const provider = smtpProvider(plainConfig());

            await provider.initialize();
            await provider.initialize();

            expect(isPortAvailableMock).toHaveBeenCalledTimes(1);
        });

        it("throws a wrapped error when the server is not available", async () => {
            expect.assertions(1);

            isPortAvailableMock.mockResolvedValue(false);

            const provider = smtpProvider(plainConfig());

            await expect(provider.initialize()).rejects.toThrow("Failed to initialize");
        });
    });

    describe("sendEmail", () => {
        it("rejects invalid email options before connecting", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({ ...baseEmail, subject: "" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Invalid email options");
        });

        it("sends successfully over a plain connection", async () => {
            expect.assertions(4);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("smtp");
            expect(result.data?.sent).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });

        it("upgrades to TLS when the server advertises STARTTLS", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["STARTTLS"] });

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(tlsConnectArgs.some((args) => args.socket !== undefined)).toBe(true);
        });

        it("connects directly over TLS in secure mode", async () => {
            expect.assertions(3);

            useServer({ ehloCaps: [] });

            const provider = smtpProvider({ host: "smtp.example.com", port: 465, secure: true });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(tlsConnectArgs.some((args) => args.socket === undefined)).toBe(true);
            expect(netConnectCount).toBe(0);
        });

        it("authenticates with AUTH LOGIN", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH LOGIN PLAIN"] });

            const provider = smtpProvider(plainConfig({ password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH LOGIN"))).toBe(true);
        });

        it("authenticates with AUTH PLAIN", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH PLAIN"] });

            const provider = smtpProvider(plainConfig({ authMethod: "PLAIN", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH PLAIN"))).toBe(true);
        });

        it("authenticates with AUTH CRAM-MD5", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH CRAM-MD5"] });

            const provider = smtpProvider(plainConfig({ authMethod: "CRAM-MD5", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH CRAM-MD5"))).toBe(true);
        });

        it("authenticates with XOAUTH2", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH XOAUTH2"] });

            const provider = smtpProvider(
                plainConfig({
                    authMethod: "OAUTH2",
                    oauth2: {
                        accessToken: "token",
                        clientId: "client",
                        clientSecret: "client-secret",
                        refreshToken: "refresh",
                        user: "smtp-user",
                    },
                    user: "smtp-user",
                }),
            );
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH XOAUTH2"))).toBe(true);
        });

        it("sends an RCPT TO for array to, array cc and single bcc", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({
                ...baseEmail,
                bcc: { email: "d@example.com" },
                cc: [{ email: "c@example.com" }],
                to: [{ email: "a@example.com" }, { email: "b@example.com" }],
            });

            expect(result.success).toBe(true);
            expect(allWrites().filter((write) => write.startsWith("RCPT TO"))).toHaveLength(4);
        });

        it("sends an RCPT TO for single cc and array bcc", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({
                ...baseEmail,
                bcc: [{ email: "d@example.com" }, { email: "e@example.com" }],
                cc: { email: "c@example.com" },
                to: { email: "a@example.com" },
            });

            expect(result.success).toBe(true);
            expect(allWrites().filter((write) => write.startsWith("RCPT TO"))).toHaveLength(4);
        });

        it("adds DSN, high priority and threading headers to the message", async () => {
            expect.assertions(10);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({
                ...baseEmail,
                dsn: { delay: true, failure: true, success: true },
                googleMailHeaders: { category: "promotions", feedbackId: "fb-1", promotionalContent: true },
                inReplyTo: "<prev@example.com>",
                listUnsubscribe: ["https://example.com/u1", "mailto:u@example.com"],
                priority: "high",
                references: ["<a@example.com>", "<b@example.com>"],
            });
            const message = lastMessage();

            expect(result.success).toBe(true);
            expect(message).toContain("X-DSN-NOTIFY: SUCCESS,FAILURE,DELAY");
            expect(message).toContain("X-Priority: 1 (Highest)");
            expect(message).toContain("Importance: High");
            expect(message).toContain("In-Reply-To: <prev@example.com>");
            expect(message).toContain("References: <a@example.com> <b@example.com>");
            expect(message).toContain("List-Unsubscribe: <https://example.com/u1>, <mailto:u@example.com>");
            expect(message).toContain("Feedback-ID: fb-1");
            expect(message).toContain("X-Google-Promotion: promotional");
            expect(message).toContain("X-Gmail-Labels: promotions");
        });

        it("adds low priority and single-value threading headers", async () => {
            expect.assertions(4);

            const provider = smtpProvider(plainConfig());

            await provider.sendEmail({
                ...baseEmail,
                listUnsubscribe: "https://example.com/u",
                priority: "low",
                references: "<single@example.com>",
            });

            const message = lastMessage();

            expect(message).toContain("X-Priority: 5 (Lowest)");
            expect(message).toContain("Importance: Low");
            expect(message).toContain("References: <single@example.com>");
            expect(message).toContain("List-Unsubscribe: <https://example.com/u>");
        });

        it("adds normal priority and a single DSN flag", async () => {
            expect.assertions(3);

            const provider = smtpProvider(plainConfig());

            await provider.sendEmail({ ...baseEmail, dsn: { success: true }, priority: "normal" });

            const message = lastMessage();

            expect(message).toContain("X-Priority: 3 (Normal)");
            expect(message).toContain("Importance: Normal");
            expect(message).toContain("X-DSN-NOTIFY: SUCCESS");
        });

        it("signs the message with DKIM when configured", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig({ dkim: { domainName: "example.com", keySelector: "default", privateKey: dkimPrivateKey } }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(lastMessage()).toContain("DKIM-Signature:");
        });

        it("skips DKIM signing when useDkim is false", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig({ dkim: { domainName: "example.com", keySelector: "default", privateKey: dkimPrivateKey } }));
            const result = await provider.sendEmail({ ...baseEmail, useDkim: false });

            expect(result.success).toBe(true);
            expect(lastMessage()).not.toContain("DKIM-Signature:");
        });

        it("recovers and logs when DKIM signing throws", async () => {
            expect.assertions(3);

            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const provider = smtpProvider(plainConfig({ dkim: { domainName: "example.com", keySelector: "default", privateKey: "not-a-valid-key" } }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(lastMessage()).not.toContain("DKIM-Signature:");
            expect(errorSpy).toHaveBeenCalledWith("[smtp] DKIM signing error:", expect.any(Error));

            errorSpy.mockRestore();
        });

        it("returns a failure when MAIL FROM is rejected", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: [], mailFromCode: "550 No such user\r\n" });

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to send email");
        });

        it("returns a failure when the message is rejected", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: [], messageCode: "554 Message rejected\r\n" });

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("returns a failure when authentication fails", async () => {
            expect.assertions(2);

            useServer({ authCode: "535 Authentication failed\r\n", ehloCaps: ["AUTH LOGIN"] });

            const provider = smtpProvider(plainConfig({ password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to send email");
        });

        it("fails when the server does not advertise authentication", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: [] });

            const provider = smtpProvider(plainConfig({ password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to send email");
        });

        it("fails when credentials are incomplete", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["AUTH LOGIN"] });

            const provider = smtpProvider(plainConfig({ user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when STARTTLS is rejected and rejectUnauthorized is true", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["STARTTLS"], starttlsCode: "454 TLS unavailable\r\n" });

            const provider = smtpProvider({ host: "smtp.example.com", port: 587, rejectUnauthorized: true, secure: false });
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to send email");
        });

        it("continues on a plain connection when STARTTLS fails and rejectUnauthorized is false", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"], starttlsCode: "454 TLS unavailable\r\n" });

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
        });

        it("fails when a command times out", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: [], silentCommand: "MAIL FROM" });

            const provider = smtpProvider(plainConfig({ timeout: 50 }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to send email");
        });

        it("fails when the TLS upgrade errors", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"] }, { tlsUpgrade: "error" });

            const provider = smtpProvider(plainConfig({ rejectUnauthorized: true }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when the TLS upgrade throws", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"] }, { tlsUpgrade: "throw" });

            const provider = smtpProvider(plainConfig({ rejectUnauthorized: true }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when the TLS upgrade times out", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"] }, { tlsUpgrade: "silent" });

            const provider = smtpProvider(plainConfig({ rejectUnauthorized: true, timeout: 50 }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when XOAUTH2 credentials are rejected", async () => {
            expect.assertions(1);

            useServer({ authCode: "535 5.7.8 bad credentials\r\n", ehloCaps: ["AUTH XOAUTH2"] });

            const provider = smtpProvider(
                plainConfig({
                    authMethod: "OAUTH2",
                    oauth2: {
                        accessToken: "token",
                        clientId: "client",
                        clientSecret: "client-secret",
                        refreshToken: "refresh",
                        user: "smtp-user",
                    },
                    user: "smtp-user",
                }),
            );
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when the CRAM-MD5 challenge is malformed", async () => {
            expect.assertions(1);

            useServer({ cramChallengeBad: true, ehloCaps: ["AUTH CRAM-MD5"] });

            const provider = smtpProvider(plainConfig({ authMethod: "CRAM-MD5", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when the CRAM-MD5 digest is rejected", async () => {
            expect.assertions(1);

            useServer({ authCode: "535 Authentication failed\r\n", ehloCaps: ["AUTH CRAM-MD5"] });

            const provider = smtpProvider(plainConfig({ authMethod: "CRAM-MD5", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when AUTH PLAIN is rejected", async () => {
            expect.assertions(1);

            useServer({ authCode: "535 Authentication failed\r\n", ehloCaps: ["AUTH PLAIN"] });

            const provider = smtpProvider(plainConfig({ authMethod: "PLAIN", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("rethrows non-authentication errors from XOAUTH2", async () => {
            expect.assertions(1);

            useServer({ authCode: "501 Syntax error\r\n", ehloCaps: ["AUTH XOAUTH2"] });

            const provider = smtpProvider(
                plainConfig({
                    authMethod: "OAUTH2",
                    oauth2: {
                        accessToken: "token",
                        clientId: "client",
                        clientSecret: "client-secret",
                        refreshToken: "refresh",
                        user: "smtp-user",
                    },
                    user: "smtp-user",
                }),
            );
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("rethrows non-authentication errors from AUTH LOGIN", async () => {
            expect.assertions(1);

            useServer({ authCode: "501 Syntax error\r\n", ehloCaps: ["AUTH LOGIN"] });

            const provider = smtpProvider(plainConfig({ password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("rethrows non-authentication errors from AUTH PLAIN", async () => {
            expect.assertions(1);

            useServer({ authCode: "501 Syntax error\r\n", ehloCaps: ["AUTH PLAIN"] });

            const provider = smtpProvider(plainConfig({ authMethod: "PLAIN", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });

        it("fails when the socket errors mid-command", async () => {
            expect.assertions(1);

            useServer({ errorCommand: "MAIL FROM" });

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
        });
    });

    describe("validateCredentials", () => {
        it("returns true when the server is reachable in secure mode", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: [] });

            const provider = smtpProvider({ host: "smtp.example.com", port: 465, secure: true });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });

        it("returns false when the server is unavailable", async () => {
            expect.assertions(1);

            isPortAvailableMock.mockResolvedValue(false);

            const provider = smtpProvider(plainConfig());

            await expect(provider.validateCredentials?.()).resolves.toBe(false);
        });

        it("returns false when authentication fails", async () => {
            expect.assertions(1);

            useServer({ authCode: "535 Authentication failed\r\n", ehloCaps: ["AUTH LOGIN"] });

            const provider = smtpProvider(plainConfig({ password: "secret", user: "smtp-user" }));

            await expect(provider.validateCredentials?.()).resolves.toBe(false);
        });

        it("validates credentials over a STARTTLS upgraded connection", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"] });

            const provider = smtpProvider(plainConfig());

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });

        it("returns false when STARTTLS fails and rejectUnauthorized is true", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"], starttlsCode: "454 TLS unavailable\r\n" });

            const provider = smtpProvider(plainConfig({ rejectUnauthorized: true }));

            await expect(provider.validateCredentials?.()).resolves.toBe(false);
        });

        it("returns false when the post-availability connection fails", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: [] }, { netFailAfter: 1 });

            const provider = smtpProvider(plainConfig());

            await expect(provider.validateCredentials?.()).resolves.toBe(false);
        });
    });

    describe("pooling", () => {
        it("reuses pooled connections and shuts them down", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig({ pool: true }));

            await provider.sendEmail(baseEmail);
            await provider.sendEmail(baseEmail);

            // initialize + first send each open a connection; the second send reuses the pooled socket.
            expect(netConnectCount).toBe(2);

            await expect(provider.shutdown?.()).resolves.toBeUndefined();
        });
    });

    describe("branch coverage", () => {
        it("defaults to the secure port when secure is set without an explicit port", async () => {
            expect.assertions(1);

            const provider = smtpProvider({ host: "smtp.example.com", secure: true });

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("accepts a custom logger in the configuration", async () => {
            expect.assertions(1);

            const provider = smtpProvider(plainConfig({ logger: console }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
        });

        it("ignores blank capability lines in the EHLO response", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: [""] });

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
        });

        it("auto-selects CRAM-MD5 when the server advertises it and no method is configured", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH CRAM-MD5"] });

            const provider = smtpProvider(plainConfig({ authMethod: "", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH CRAM-MD5"))).toBe(true);
        });

        it("auto-selects LOGIN when CRAM-MD5 is unavailable", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH LOGIN"] });

            const provider = smtpProvider(plainConfig({ authMethod: "", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH LOGIN"))).toBe(true);
        });

        it("auto-selects PLAIN as the final fallback", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH PLAIN"] });

            const provider = smtpProvider(plainConfig({ authMethod: "", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(true);
            expect(allWrites().some((write) => write.startsWith("AUTH PLAIN"))).toBe(true);
        });

        it("fails when no supported authentication method is advertised", async () => {
            expect.assertions(2);

            useServer({ ehloCaps: ["AUTH UNKNOWN-METHOD"] });

            const provider = smtpProvider(plainConfig({ authMethod: "", password: "secret", user: "smtp-user" }));
            const result = await provider.sendEmail(baseEmail);

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("No supported authentication methods");
        });

        it("adds no DSN header when every notification flag is unset", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({ ...baseEmail, dsn: {} });

            expect(result.success).toBe(true);
            expect(lastMessage()).not.toContain("X-DSN-NOTIFY");
        });

        it("treats an unknown priority as normal", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({ ...baseEmail, priority: "urgent" as unknown as "high" });

            expect(result.success).toBe(true);
            expect(lastMessage()).toContain("X-Priority: 3 (Normal)");
        });

        it("adds no Google Mail headers when the fields are unset", async () => {
            expect.assertions(2);

            const provider = smtpProvider(plainConfig());
            const result = await provider.sendEmail({ ...baseEmail, googleMailHeaders: {} });

            expect(result.success).toBe(true);
            expect(lastMessage()).not.toContain("Feedback-ID");
        });

        it("validates credentials over a plain connection when STARTTLS fails and rejectUnauthorized is false", async () => {
            expect.assertions(1);

            useServer({ ehloCaps: ["STARTTLS"], starttlsCode: "454 TLS unavailable\r\n" });

            const provider = smtpProvider(plainConfig());

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });
    });
});
