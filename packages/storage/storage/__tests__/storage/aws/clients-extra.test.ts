import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { akamai, backblaze, cloudflare, digitalOcean, hetzner, minio, storj, tigris, wasabi } from "../../../src/storage/aws/clients";

let savedEnvironment: NodeJS.ProcessEnv;

const PROVIDER_KEY = /^(?:AKAMAI|BACKBLAZE|B2|CLOUDFLARE|SPACES|HETZNER|MINIO|STORJ|TIGRIS|WASABI)_/;

const isHostManagedKey = (key: string): boolean => key.startsWith("AWS_") || PROVIDER_KEY.test(key);

const credentials = { accessKeyId: "ak", secretAccessKey: "sk" };

describe("additional aws s3-compatible client presets", () => {
    beforeEach(() => {
        savedEnvironment = { ...process.env };

        process.env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !isHostManagedKey(key)));
    });

    afterEach(() => {
        process.env = savedEnvironment;
    });

    describe(akamai, () => {
        it("builds the region endpoint", () => {
            expect(akamai({ ...credentials, region: "us-iad-1" })).toStrictEqual({
                credentials,
                endpoint: "https://us-iad-1.linodeobjects.com",
                forcePathStyle: false,
                region: "us-iad-1",
            });
        });

        it("supports explicit endpoint override", () => {
            expect(akamai({ ...credentials, endpoint: "https://example.test", region: "us-iad-1" }).endpoint).toBe("https://example.test");
        });

        it("throws when region is missing", () => {
            expect(() => akamai({ ...credentials })).toThrow(/Missing required parameters/);
        });

        it("picks up credentials and region from environment", () => {
            process.env.AKAMAI_ACCESS_KEY_ID = "env-ak";
            process.env.AKAMAI_SECRET_ACCESS_KEY = "env-sk";
            process.env.AKAMAI_REGION = "us-sea-1";

            expect(akamai()).toStrictEqual({
                credentials: { accessKeyId: "env-ak", secretAccessKey: "env-sk" },
                endpoint: "https://us-sea-1.linodeobjects.com",
                forcePathStyle: false,
                region: "us-sea-1",
            });
        });
    });

    describe(backblaze, () => {
        it("builds the region endpoint with application key credentials", () => {
            expect(
                backblaze({
                    applicationKey: "sk",
                    applicationKeyId: "ak",
                    region: "us-west-001",
                }),
            ).toStrictEqual({
                credentials,
                endpoint: "https://s3.us-west-001.backblazeb2.com",
                region: "us-west-001",
            });
        });

        it("throws when application key is missing", () => {
            expect(() => backblaze({ applicationKeyId: "ak", region: "us-west-001" } as never)).toThrow(/Missing required parameters/);
        });

        it("reads from B2_ environment variables", () => {
            process.env.B2_APP_KEY_ID = "env-ak";
            process.env.B2_APP_KEY = "env-sk";
            process.env.B2_REGION = "eu-central-003";

            expect(backblaze()).toStrictEqual({
                credentials: { accessKeyId: "env-ak", secretAccessKey: "env-sk" },
                endpoint: "https://s3.eu-central-003.backblazeb2.com",
                region: "eu-central-003",
            });
        });
    });

    describe(cloudflare, () => {
        it("builds the account-scoped R2 endpoint", () => {
            expect(cloudflare({ ...credentials, accountId: "abc123" })).toStrictEqual({
                credentials,
                endpoint: "https://abc123.r2.cloudflarestorage.com",
                region: "auto",
            });
        });

        it("includes the jurisdiction segment when provided", () => {
            expect(cloudflare({ ...credentials, accountId: "abc123", jurisdiction: "eu" }).endpoint).toBe("https://abc123.eu.r2.cloudflarestorage.com");
        });

        it("throws when accountId is missing", () => {
            expect(() => cloudflare({ ...credentials })).toThrow(/Missing required parameters/);
        });
    });

    describe(digitalOcean, () => {
        it("builds the regional spaces endpoint and overrides the signing region", () => {
            expect(digitalOcean({ key: "ak", region: "nyc3", secret: "sk" })).toStrictEqual({
                credentials,
                endpoint: "https://nyc3.digitaloceanspaces.com",
                forcePathStyle: false,
                region: "us-east-1",
            });
        });

        it("throws when secret is missing", () => {
            expect(() => digitalOcean({ key: "ak", region: "nyc3" } as never)).toThrow(/Missing required parameters/);
        });

        it("reads SPACES_* env vars", () => {
            process.env.SPACES_KEY = "env-ak";
            process.env.SPACES_SECRET = "env-sk";
            process.env.SPACES_REGION = "ams3";

            expect(digitalOcean()).toStrictEqual({
                credentials: { accessKeyId: "env-ak", secretAccessKey: "env-sk" },
                endpoint: "https://ams3.digitaloceanspaces.com",
                forcePathStyle: false,
                region: "us-east-1",
            });
        });
    });

    describe(hetzner, () => {
        it("builds the regional object-storage endpoint", () => {
            expect(hetzner({ ...credentials, location: "fsn1" })).toStrictEqual({
                credentials,
                endpoint: "https://fsn1.your-objectstorage.com",
                forcePathStyle: false,
                region: "fsn1",
            });
        });

        it("rejects an unknown location", () => {
            // @ts-expect-error -- testing runtime validation
            expect(() => hetzner({ ...credentials, location: "us-east-1" })).toThrow(/Invalid Hetzner location/);
        });

        it("throws when credentials are missing", () => {
            // @ts-expect-error -- exercising runtime guard
            expect(() => hetzner({ location: "fsn1" })).toThrow(/Missing required parameters/);
        });
    });

    describe(minio, () => {
        it("builds with custom endpoint and forces path-style addressing", () => {
            expect(
                minio({
                    ...credentials,
                    endpoint: "http://minio.local:9000",
                    region: "us-east-1",
                }),
            ).toStrictEqual({
                credentials,
                endpoint: "http://minio.local:9000",
                forcePathStyle: true,
                region: "us-east-1",
            });
        });

        it("throws when endpoint is missing", () => {
            expect(() => minio({ ...credentials, region: "us-east-1" } as never)).toThrow(/Missing required parameters/);
        });
    });

    describe(storj, () => {
        it("defaults to the global gateway endpoint", () => {
            expect(storj({ ...credentials })).toStrictEqual({
                credentials,
                endpoint: "https://gateway.storjshare.io",
                forcePathStyle: false,
                region: "global",
            });
        });

        it("honors an explicit endpoint", () => {
            expect(storj({ ...credentials, endpoint: "https://self-hosted.example/" }).endpoint).toBe("https://self-hosted.example/");
        });

        it("throws when credentials are missing", () => {
            expect(() => storj({})).toThrow(/Missing required parameters/);
        });
    });

    describe(tigris, () => {
        it("defaults to t3.storage.dev endpoint", () => {
            expect(tigris({ ...credentials })).toStrictEqual({
                credentials,
                endpoint: "https://t3.storage.dev",
                forcePathStyle: false,
                region: "auto",
            });
        });

        it("honors an explicit endpoint", () => {
            expect(tigris({ ...credentials, endpoint: "https://eu.tigris.dev" }).endpoint).toBe("https://eu.tigris.dev");
        });

        it("throws when credentials are missing", () => {
            expect(() => tigris({})).toThrow(/Missing required parameters/);
        });
    });

    describe(wasabi, () => {
        it("builds the regional endpoint and sets the apiVersion", () => {
            expect(wasabi({ ...credentials, region: "us-east-1" })).toStrictEqual({
                apiVersion: "2006-03-01",
                credentials,
                endpoint: "https://s3.us-east-1.wasabisys.com",
                region: "us-east-1",
            });
        });

        it("throws when region is missing", () => {
            expect(() => wasabi({ ...credentials } as never)).toThrow(/Missing required parameters/);
        });
    });
});
