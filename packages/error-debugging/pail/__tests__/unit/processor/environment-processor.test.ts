import { afterEach, beforeEach, describe, expect, it } from "vitest";

import EnvironmentProcessor, { detectEnvironment } from "../../../src/processor/environment-processor";
import type { Meta } from "../../../src/types";

const createMeta = (overrides: Partial<Meta<string>> = {}): Meta<string> =>
    ({
        badge: undefined,
        context: undefined,
        date: new Date(),
        error: undefined,
        groups: [],
        label: undefined,
        message: "test message",
        prefix: undefined,
        scope: undefined,
        suffix: undefined,
        traceError: undefined,
        type: { level: "informational", name: "info" },
        ...overrides,
    }) as Meta<string>;

describe("environmentProcessor", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe(detectEnvironment, () => {
        it("should detect NODE_ENV", () => {
            expect.assertions(1);

            process.env.NODE_ENV = "production";
            const info = detectEnvironment();

            expect(info.environment).toBe("production");
        });

        it("should detect service name from SERVICE_NAME", () => {
            expect.assertions(1);

            process.env.SERVICE_NAME = "my-api";
            const info = detectEnvironment();

            expect(info.service).toBe("my-api");
        });

        it("should detect version from npm_package_version", () => {
            expect.assertions(1);

            process.env.npm_package_version = "1.2.3";
            const info = detectEnvironment();

            expect(info.version).toBe("1.2.3");
        });

        it("should detect AWS region", () => {
            expect.assertions(1);

            process.env.AWS_REGION = "us-east-1";
            const info = detectEnvironment();

            expect(info.region).toBe("us-east-1");
        });

        it("should detect Vercel commit SHA and truncate to 7 chars", () => {
            expect.assertions(1);

            process.env.VERCEL_GIT_COMMIT_SHA = "abc1234567890";
            const info = detectEnvironment();

            expect(info.commit).toBe("abc1234");
        });

        it("should detect FLY_APP_NAME as service", () => {
            expect.assertions(1);

            process.env.FLY_APP_NAME = "fly-service";
            const info = detectEnvironment();

            expect(info.service).toBe("fly-service");
        });

        it("should detect HOSTNAME", () => {
            expect.assertions(1);

            process.env.HOSTNAME = "server-01";
            const info = detectEnvironment();

            expect(info.hostname).toBe("server-01");
        });

        it("should include PID", () => {
            expect.assertions(1);

            const info = detectEnvironment();

            expect(info.pid).toBe(process.pid);
        });

        it("should prioritize SERVICE_NAME over platform-specific vars", () => {
            expect.assertions(1);

            process.env.SERVICE_NAME = "explicit-service";
            process.env.FLY_APP_NAME = "fly-service";
            const info = detectEnvironment();

            expect(info.service).toBe("explicit-service");
        });

        it("should fallback to ENVIRONMENT when NODE_ENV is not set", () => {
            expect.assertions(1);

            delete process.env.NODE_ENV;
            process.env.ENVIRONMENT = "staging";
            const info = detectEnvironment();

            expect(info.environment).toBe("staging");
        });

        it("should fallback to APP_ENV when NODE_ENV and ENVIRONMENT are not set", () => {
            expect.assertions(1);

            delete process.env.NODE_ENV;
            delete process.env.ENVIRONMENT;
            process.env.APP_ENV = "qa";
            const info = detectEnvironment();

            expect(info.environment).toBe("qa");
        });

        it("should leave environment undefined when no environment vars are set", () => {
            expect.assertions(1);

            delete process.env.NODE_ENV;
            delete process.env.ENVIRONMENT;
            delete process.env.APP_ENV;
            const info = detectEnvironment();

            expect(info.environment).toBeUndefined();
        });

        it("should detect GCP Cloud Run K_SERVICE", () => {
            expect.assertions(1);

            process.env.K_SERVICE = "cloud-run-service";
            const info = detectEnvironment();

            expect(info.service).toBe("cloud-run-service");
        });

        it("should detect GCP Cloud Run K_REVISION as version", () => {
            expect.assertions(1);

            delete process.env.APP_VERSION;
            delete process.env.npm_package_version;
            process.env.K_REVISION = "cloud-run-service-00001-abc";
            const info = detectEnvironment();

            expect(info.version).toBe("cloud-run-service-00001-abc");
        });

        it("should detect GCP App Engine GAE_SERVICE", () => {
            expect.assertions(1);

            process.env.GAE_SERVICE = "appengine-svc";
            const info = detectEnvironment();

            expect(info.service).toBe("appengine-svc");
        });

        it("should detect GCP App Engine GAE_VERSION", () => {
            expect.assertions(1);

            delete process.env.APP_VERSION;
            delete process.env.npm_package_version;
            process.env.GAE_VERSION = "20240101t120000";
            const info = detectEnvironment();

            expect(info.version).toBe("20240101t120000");
        });

        it("should detect GCP Cloud Functions FUNCTION_TARGET as service", () => {
            expect.assertions(1);

            process.env.FUNCTION_TARGET = "myFunction";
            const info = detectEnvironment();

            expect(info.service).toBe("myFunction");
        });

        it("should detect GOOGLE_CLOUD_REGION", () => {
            expect.assertions(1);

            process.env.GOOGLE_CLOUD_REGION = "us-central1";
            const info = detectEnvironment();

            expect(info.region).toBe("us-central1");
        });

        it("should detect GCP FUNCTION_REGION", () => {
            expect.assertions(1);

            process.env.FUNCTION_REGION = "europe-west1";
            const info = detectEnvironment();

            expect(info.region).toBe("europe-west1");
        });

        it("should treat empty string env vars as falsy and not include them", () => {
            expect.assertions(2);

            process.env.SERVICE_NAME = "";
            process.env.VERCEL_GIT_COMMIT_SHA = "";
            const info = detectEnvironment();

            expect(info.service).toBeUndefined();
            expect(info.commit).toBeUndefined();
        });

        it("should return empty object when process is not available", () => {
            expect.assertions(1);

            const originalProcess = globalThis.process;

            try {
                // @ts-expect-error - simulating browser environment
                globalThis.process = undefined;

                const info = detectEnvironment();

                expect(info).toStrictEqual({});
            } finally {
                globalThis.process = originalProcess;
            }
        });
    });

    describe("processor", () => {
        it("should add environment info to meta", () => {
            expect.assertions(2);

            const processor = new EnvironmentProcessor({
                overrides: { service: "test-service" },
            });

            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage).toBeDefined();
            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.service).toBe("test-service");
        });

        it("should use overrides over detected values", () => {
            expect.assertions(1);

            process.env.NODE_ENV = "production";

            const processor = new EnvironmentProcessor({
                overrides: { environment: "custom" },
            });

            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.environment).toBe("custom");
        });

        it("should not overwrite detected values when overrides contain explicit undefined", () => {
            expect.assertions(1);

            process.env.NODE_ENV = "production";

            const processor = new EnvironmentProcessor({
                overrides: { environment: undefined, service: undefined },
            });

            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.environment).toBe("production");
        });

        it("should exclude PID by default", () => {
            expect.assertions(1);

            const processor = new EnvironmentProcessor();
            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.pid).toBeUndefined();
        });

        it("should include PID when requested", () => {
            expect.assertions(1);

            const processor = new EnvironmentProcessor({ includePid: true });
            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.pid).toBe(process.pid);
        });

        it("should preserve pid override even when includePid is false", () => {
            expect.assertions(1);

            const processor = new EnvironmentProcessor({
                includePid: false,
                overrides: { pid: 9999 },
            });

            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.pid).toBe(9999);
        });

        it("should exclude hostname by default", () => {
            expect.assertions(1);

            process.env.HOSTNAME = "server-01";
            const processor = new EnvironmentProcessor();
            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.hostname).toBeUndefined();
        });

        it("should include hostname when requested", () => {
            expect.assertions(1);

            process.env.HOSTNAME = "server-01";
            const processor = new EnvironmentProcessor({ includeHostname: true });
            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.hostname).toBe("server-01");
        });

        it("should preserve hostname override even when includeHostname is false", () => {
            expect.assertions(1);

            const processor = new EnvironmentProcessor({
                includeHostname: false,
                overrides: { hostname: "custom-host" },
            });

            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage?.hostname).toBe("custom-host");
        });

        it("should return environment info via getEnvironmentInfo", () => {
            expect.assertions(2);

            const processor = new EnvironmentProcessor({
                overrides: { service: "my-service", version: "1.0.0" },
            });

            const info = processor.getEnvironmentInfo();

            expect(info.service).toBe("my-service");
            expect(info.version).toBe("1.0.0");
        });

        it("should return a clone from getEnvironmentInfo to prevent mutation", () => {
            expect.assertions(2);

            const processor = new EnvironmentProcessor({
                overrides: { service: "original" },
            });

            const info1 = processor.getEnvironmentInfo();

            (info1 as Record<string, unknown>).service = "mutated";

            const info2 = processor.getEnvironmentInfo();

            expect(info2.service).toBe("original");
            expect(info1.service).toBe("mutated");
        });

        it("should return separate clones per process() call to prevent cross-record mutation", () => {
            expect.assertions(2);

            const processor = new EnvironmentProcessor({
                overrides: { service: "my-service" },
            });

            const meta1 = createMeta();
            const result1 = processor.process(meta1);
            const env1 = (result1 as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage;

            const meta2 = createMeta();
            const result2 = processor.process(meta2);
            const env2 = (result2 as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage;

            // Mutate the first record's env
            // eslint-disable-next-line vitest/no-conditional-in-test
            if (env1) {
                env1.service = "mutated";
            }

            // Second record should be unaffected
            expect(env2?.service).toBe("my-service");
            expect(env1?.service).toBe("mutated");
        });

        it("should work with default options", () => {
            expect.assertions(1);

            const processor = new EnvironmentProcessor();
            const meta = createMeta();
            const result = processor.process(meta);

            expect((result as Meta<string> & { envStorage?: Record<string, unknown> }).envStorage).toBeDefined();
        });
    });
});
