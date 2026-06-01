import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransportContext } from "../src/transports/context";

// Each transport validator imports `tryImport` (and the URI helpers) from
// `./runtime`. Mock that module so we can hand the validators a fake driver and
// drive the verified / rejected / error branches without opening a real socket.
const tryImportMock = vi.fn<(packageName: string, type: string) => Promise<unknown>>();

vi.mock(import("../src/transports/runtime"), async () => {
    const actual = await vi.importActual<typeof import("../src/transports/runtime")>("../src/transports/runtime");

    return {
        ...actual,
        tryImport: (packageName: string, type: string): Promise<unknown> => tryImportMock(packageName, type),
    };
});

const baseContext = (overrides: Partial<TransportContext> = {}): TransportContext => {
    return {
        extras: {},
        secret: "",
        validation: {},
        ...overrides,
    };
};

// Plain constructor function returning an object — avoids `class` declarations
// (the repo lints `max-classes-per-file: 1` and `class-methods-use-this`) while
// still being `new`-able the way the transport drivers expect.
const constructable = <T>(make: () => T): new (...args: unknown[]) => T => {
    const Ctor = function Ctor(this: unknown): T {
        return make();
    };

    return Ctor as unknown as new (...args: unknown[]) => T;
};

beforeEach(() => {
    tryImportMock.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("validateAws", () => {
    const fakeAccessKeyId = "AKIAIOSFODNN7EXAMPLE";
    const fakeSecret = "x".repeat(40);

    const makeStsModule = (send: () => Promise<{ Account?: string }>): Record<string, unknown> => {
        return {
            GetCallerIdentityCommand: constructable(() => {
                return {};
            }),
            STSClient: constructable(() => {
                return {
                    destroy: (): void => undefined,
                    send,
                };
            }),
        };
    };

    it("returns 'skipped' when the paired AKID is missing", async () => {
        expect.assertions(2);

        const { validateAws } = await import("../src/transports/aws");

        await expect(validateAws(baseContext({ secret: fakeSecret }))).resolves.toBe("skipped");
        expect(tryImportMock).not.toHaveBeenCalled();
    });

    it("returns 'skipped' when the AWS SDK isn't installed", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(undefined);

        const { validateAws } = await import("../src/transports/aws");

        await expect(validateAws(baseContext({ extras: { AKID: fakeAccessKeyId }, secret: fakeSecret }))).resolves.toBe("skipped");
    });

    it("returns 'verified' when GetCallerIdentity resolves an account", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeStsModule(() => Promise.resolve({ Account: "123456789012" })));

        const { validateAws } = await import("../src/transports/aws");

        await expect(validateAws(baseContext({ extras: { AKID: fakeAccessKeyId }, secret: fakeSecret }))).resolves.toBe("verified");
    });

    it("returns 'rejected' when GetCallerIdentity resolves without an account", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeStsModule(() => Promise.resolve({})));

        const { validateAws } = await import("../src/transports/aws");

        await expect(validateAws(baseContext({ extras: { AKID: fakeAccessKeyId }, secret: fakeSecret }))).resolves.toBe("rejected");
    });

    it("returns 'rejected' on an STS auth error", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(
            makeStsModule(() => Promise.reject(new Error("InvalidClientTokenId: The security token included in the request is invalid."))),
        );

        const { validateAws } = await import("../src/transports/aws");

        await expect(validateAws(baseContext({ extras: { AKID: fakeAccessKeyId }, secret: fakeSecret }))).resolves.toBe("rejected");
    });

    it("returns 'error' on a non-auth failure", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeStsModule(() => Promise.reject(new Error("getaddrinfo ENOTFOUND sts.amazonaws.com"))));

        const { validateAws } = await import("../src/transports/aws");

        await expect(validateAws(baseContext({ extras: { AKID: fakeAccessKeyId }, secret: fakeSecret }))).resolves.toBe("error");
    });
});

describe("validateGcp", () => {
    const validServiceAccount = JSON.stringify({
        client_email: "svc@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });

    const makeJwtModule = (authorize: () => Promise<{ access_token?: string }>): Record<string, unknown> => {
        return {
            JWT: constructable(() => {
                return { authorize };
            }),
        };
    };

    it("returns 'rejected' when the secret isn't valid JSON", async () => {
        expect.assertions(2);

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: "not-json" }))).resolves.toBe("rejected");
        expect(tryImportMock).not.toHaveBeenCalled();
    });

    it("returns 'rejected' when required service-account fields are missing", async () => {
        expect.assertions(1);

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: JSON.stringify({ client_email: "only-email@x.com" }) }))).resolves.toBe("rejected");
    });

    it("returns 'skipped' when google-auth-library isn't installed", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(undefined);

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: validServiceAccount }))).resolves.toBe("skipped");
    });

    it("returns 'verified' when authorize yields an access token", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeJwtModule(() => Promise.resolve({ access_token: "ya29.fake-token" })));

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: validServiceAccount }))).resolves.toBe("verified");
    });

    it("returns 'rejected' when authorize yields no access token", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeJwtModule(() => Promise.resolve({})));

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: validServiceAccount }))).resolves.toBe("rejected");
    });

    it("returns 'rejected' on an invalid_grant authorize error", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeJwtModule(() => Promise.reject(new Error("invalid_grant: account not found"))));

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: validServiceAccount }))).resolves.toBe("rejected");
    });

    it("returns 'error' on a non-auth authorize failure", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeJwtModule(() => Promise.reject(new Error("network unreachable"))));

        const { validateGcp } = await import("../src/transports/gcp");

        await expect(validateGcp(baseContext({ secret: validServiceAccount }))).resolves.toBe("error");
    });
});

describe("validateMySQL", () => {
    const uri = "mysql://root:secret@db.internal:3306/app";

    const makeMysqlModule = (ping: () => Promise<void>): Record<string, unknown> => {
        return {
            createConnection: (): Promise<{ end: () => Promise<void>; ping: () => Promise<void> }> =>
                Promise.resolve({ end: (): Promise<void> => Promise.resolve(), ping }),
        };
    };

    it("returns 'skipped' when no mysql URI can be extracted", async () => {
        expect.assertions(2);

        const { validateMySQL } = await import("../src/transports/mysql");

        await expect(validateMySQL(baseContext({ secret: "no uri here" }))).resolves.toBe("skipped");
        expect(tryImportMock).not.toHaveBeenCalled();
    });

    it("returns 'skipped' when mysql2 isn't installed", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(undefined);

        const { validateMySQL } = await import("../src/transports/mysql");

        await expect(validateMySQL(baseContext({ secret: uri }))).resolves.toBe("skipped");
    });

    it("returns 'verified' when the ping succeeds", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeMysqlModule(() => Promise.resolve()));

        const { validateMySQL } = await import("../src/transports/mysql");

        await expect(validateMySQL(baseContext({ secret: uri }))).resolves.toBe("verified");
    });

    it("returns 'rejected' on an access-denied error", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeMysqlModule(() => Promise.reject(new Error("Access denied for user 'root'@'host'"))));

        const { validateMySQL } = await import("../src/transports/mysql");

        await expect(validateMySQL(baseContext({ secret: uri }))).resolves.toBe("rejected");
    });

    it("returns 'error' on a connection failure", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeMysqlModule(() => Promise.reject(new Error("connect ETIMEDOUT"))));

        const { validateMySQL } = await import("../src/transports/mysql");

        await expect(validateMySQL(baseContext({ secret: uri }))).resolves.toBe("error");
    });
});

describe("validatePostgres", () => {
    const uri = "postgres://user:pass@host:5432/db";

    const makePgModule = (parts: { connect: () => Promise<void>; query: () => Promise<unknown> }): Record<string, unknown> => {
        return {
            default: {
                Client: constructable(() => {
                    return {
                        connect: parts.connect,
                        end: (): Promise<void> => Promise.resolve(),
                        query: parts.query,
                    };
                }),
            },
        };
    };

    it("returns 'skipped' when no postgres URI can be extracted", async () => {
        expect.assertions(2);

        const { validatePostgres } = await import("../src/transports/postgres");

        await expect(validatePostgres(baseContext({ secret: "no uri here" }))).resolves.toBe("skipped");
        expect(tryImportMock).not.toHaveBeenCalled();
    });

    it("returns 'skipped' when pg isn't installed", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(undefined);

        const { validatePostgres } = await import("../src/transports/postgres");

        await expect(validatePostgres(baseContext({ secret: uri }))).resolves.toBe("skipped");
    });

    it("returns 'verified' when connect + query succeed", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makePgModule({ connect: () => Promise.resolve(), query: () => Promise.resolve({ rows: [] }) }));

        const { validatePostgres } = await import("../src/transports/postgres");

        await expect(validatePostgres(baseContext({ secret: uri }))).resolves.toBe("verified");
    });

    it("returns 'rejected' on a password-authentication error", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(
            makePgModule({ connect: () => Promise.reject(new Error('password authentication failed for user "user"')), query: () => Promise.resolve() }),
        );

        const { validatePostgres } = await import("../src/transports/postgres");

        await expect(validatePostgres(baseContext({ secret: uri }))).resolves.toBe("rejected");
    });

    it("returns 'error' on a connection failure", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makePgModule({ connect: () => Promise.reject(new Error("connection refused")), query: () => Promise.resolve() }));

        const { validatePostgres } = await import("../src/transports/postgres");

        await expect(validatePostgres(baseContext({ secret: uri }))).resolves.toBe("error");
    });

    it("extracts a postgresql:// URI via the secondary scheme fallback", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makePgModule({ connect: () => Promise.resolve(), query: () => Promise.resolve() }));

        const { validatePostgres } = await import("../src/transports/postgres");

        await expect(validatePostgres(baseContext({ secret: "postgresql://user:pass@host:5432/db" }))).resolves.toBe("verified");
    });
});

describe("validateMongoDB", () => {
    const uri = "mongodb://user:pass@host:27017/db";

    const makeMongoModule = (command: () => Promise<unknown>): Record<string, unknown> => {
        return {
            MongoClient: constructable(() => {
                return {
                    close: (): Promise<void> => Promise.resolve(),
                    connect: (): Promise<unknown> => Promise.resolve(),
                    db: (): { command: () => Promise<unknown> } => {
                        return { command };
                    },
                };
            }),
        };
    };

    it("returns 'skipped' when no mongodb URI can be extracted", async () => {
        expect.assertions(2);

        const { validateMongoDB } = await import("../src/transports/mongodb");

        await expect(validateMongoDB(baseContext({ secret: "no uri here" }))).resolves.toBe("skipped");
        expect(tryImportMock).not.toHaveBeenCalled();
    });

    it("returns 'skipped' when mongodb isn't installed", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(undefined);

        const { validateMongoDB } = await import("../src/transports/mongodb");

        await expect(validateMongoDB(baseContext({ secret: uri }))).resolves.toBe("skipped");
    });

    it("returns 'verified' when the ping command succeeds", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeMongoModule(() => Promise.resolve({ ok: 1 })));

        const { validateMongoDB } = await import("../src/transports/mongodb");

        await expect(validateMongoDB(baseContext({ secret: uri }))).resolves.toBe("verified");
    });

    it("returns 'rejected' on an authentication-failed error", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeMongoModule(() => Promise.reject(new Error("Authentication failed."))));

        const { validateMongoDB } = await import("../src/transports/mongodb");

        await expect(validateMongoDB(baseContext({ secret: uri }))).resolves.toBe("rejected");
    });

    it("returns 'error' on a non-auth failure", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue(makeMongoModule(() => Promise.reject(new Error("topology was destroyed"))));

        const { validateMongoDB } = await import("../src/transports/mongodb");

        await expect(validateMongoDB(baseContext({ secret: uri }))).resolves.toBe("error");
    });
});

describe("validateJdbc", () => {
    it("returns 'skipped' for a non-JDBC string", async () => {
        expect.assertions(1);

        const { validateJdbc } = await import("../src/transports/jdbc");

        await expect(validateJdbc(baseContext({ secret: "mysql://host/db" }))).resolves.toBe("skipped");
    });

    it("dispatches jdbc:mysql to the MySQL validator", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue({
            createConnection: (): Promise<{ end: () => Promise<void>; ping: () => Promise<void> }> =>
                Promise.resolve({ end: (): Promise<void> => Promise.resolve(), ping: (): Promise<void> => Promise.resolve() }),
        });

        const { validateJdbc } = await import("../src/transports/jdbc");

        await expect(validateJdbc(baseContext({ secret: "jdbc:mysql://root:pw@host:3306/app" }))).resolves.toBe("verified");
    });

    it("dispatches jdbc:postgresql to the Postgres validator", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue({
            default: {
                Client: constructable(() => {
                    return {
                        connect: (): Promise<void> => Promise.resolve(),
                        end: (): Promise<void> => Promise.resolve(),
                        query: (): Promise<unknown> => Promise.resolve(),
                    };
                }),
            },
        });

        const { validateJdbc } = await import("../src/transports/jdbc");

        await expect(validateJdbc(baseContext({ secret: "jdbc:postgresql://user:pw@host:5432/db" }))).resolves.toBe("verified");
    });

    it("dispatches jdbc:mongodb to the MongoDB validator", async () => {
        expect.assertions(1);

        tryImportMock.mockResolvedValue({
            MongoClient: constructable(() => {
                return {
                    close: (): Promise<void> => Promise.resolve(),
                    connect: (): Promise<unknown> => Promise.resolve(),
                    db: (): { command: () => Promise<unknown> } => {
                        return { command: (): Promise<unknown> => Promise.resolve({ ok: 1 }) };
                    },
                };
            }),
        });

        const { validateJdbc } = await import("../src/transports/jdbc");

        await expect(validateJdbc(baseContext({ secret: "jdbc:mongodb://user:pw@host:27017/db" }))).resolves.toBe("verified");
    });

    it("returns 'skipped' for an unsupported JDBC sub-protocol", async () => {
        expect.assertions(1);

        const { validateJdbc } = await import("../src/transports/jdbc");

        await expect(validateJdbc(baseContext({ secret: "jdbc:oracle://host:1521/ORCL" }))).resolves.toBe("skipped");
    });
});
