import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { alibaba, exoscale, filebase, ibmCos, idriveE2, oracleCloud, ovhCloud, scaleway, tencent, vultr, yandex } from "../../../src/storage/aws/clients";

// These presets read credentials/region from process.env at call time. Host
// env (notably AWS_REGION in CI) must not leak into the assertions, so the
// environment is snapshotted and fully restored around every test.
let savedEnvironment: NodeJS.ProcessEnv;

const PROVIDER_KEY = /^(?:ALIBABA|EXOSCALE|FILEBASE|IBM_COS|IDRIVE_E2|ORACLE_CLOUD|OVHCLOUD|SCALEWAY|TENCENT|VULTR|YANDEX)_/;

const isHostManagedKey = (key: string): boolean => key.startsWith("AWS_") || PROVIDER_KEY.test(key);

const credentials = { accessKeyId: "ak", secretAccessKey: "sk" };

describe("aws s3-compatible client presets", () => {
    beforeEach(() => {
        savedEnvironment = { ...process.env };

        process.env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !isHostManagedKey(key)));
    });

    afterEach(() => {
        process.env = savedEnvironment;
    });

    it("scaleway builds the region endpoint and forces virtual-hosted style", () => {
        expect(scaleway({ ...credentials, region: "nl-ams" })).toStrictEqual({
            credentials,
            endpoint: "https://s3.nl-ams.scw.cloud",
            forcePathStyle: false,
            region: "nl-ams",
        });
    });

    it("scaleway rejects a region outside the closed set", () => {
        // @ts-expect-error — exercising the runtime guard with an invalid region
        expect(() => scaleway({ ...credentials, region: "us-east-1" })).toThrow(/Invalid Scaleway region/);
    });

    it("scaleway honours an explicit endpoint override", () => {
        expect(scaleway({ ...credentials, endpoint: "https://example.test", region: "fr-par" }).endpoint).toBe("https://example.test");
    });

    it("vultr maps the location to both region and endpoint subdomain", () => {
        expect(vultr({ ...credentials, location: "ewr1" })).toStrictEqual({
            credentials,
            endpoint: "https://ewr1.vultrobjects.com",
            forcePathStyle: false,
            region: "ewr1",
        });
    });

    it("exoscale maps the zone to both region and endpoint subdomain", () => {
        expect(exoscale({ ...credentials, zone: "ch-gva-2" })).toStrictEqual({
            credentials,
            endpoint: "https://sos-ch-gva-2.exo.io",
            forcePathStyle: false,
            region: "ch-gva-2",
        });
    });

    it("filebase uses a fixed endpoint/region and path-style", () => {
        expect(filebase({ ...credentials })).toStrictEqual({
            credentials,
            endpoint: "https://s3.filebase.com",
            forcePathStyle: true,
            region: "us-east-1",
        });
    });

    it("idrive-e2 requires an explicit endpoint", () => {
        expect(() => idriveE2({ ...credentials } as never)).toThrow(/Missing required parameters for iDrive e2/);
        expect(idriveE2({ ...credentials, endpoint: "https://x.va.idrivee2-1.com" })).toStrictEqual({
            credentials,
            endpoint: "https://x.va.idrivee2-1.com",
            forcePathStyle: true,
            region: "us-east-1",
        });
    });

    it("ibm-cos builds the region endpoint", () => {
        expect(ibmCos({ ...credentials, region: "eu-de" })).toStrictEqual({
            credentials,
            endpoint: "https://s3.eu-de.cloud-object-storage.appdomain.cloud",
            forcePathStyle: false,
            region: "eu-de",
        });
    });

    it("oracle-cloud builds the namespace-scoped host with path-style", () => {
        expect(oracleCloud({ ...credentials, namespace: "ns", region: "eu-frankfurt-1" })).toStrictEqual({
            credentials,
            endpoint: "https://ns.compat.objectstorage.eu-frankfurt-1.oraclecloud.com",
            forcePathStyle: true,
            region: "eu-frankfurt-1",
        });
    });

    it("ovhcloud lowercases the console-style region for endpoint and signing", () => {
        expect(ovhCloud({ ...credentials, region: "GRA" })).toStrictEqual({
            credentials,
            endpoint: "https://s3.gra.io.cloud.ovh.net",
            forcePathStyle: false,
            region: "gra",
        });
    });

    it("alibaba builds the region endpoint", () => {
        expect(alibaba({ ...credentials, region: "cn-hangzhou" })).toStrictEqual({
            credentials,
            endpoint: "https://s3.oss-cn-hangzhou.aliyuncs.com",
            forcePathStyle: false,
            region: "cn-hangzhou",
        });
    });

    it("tencent builds the region endpoint", () => {
        expect(tencent({ ...credentials, region: "ap-guangzhou" })).toStrictEqual({
            credentials,
            endpoint: "https://cos.ap-guangzhou.myqcloud.com",
            forcePathStyle: false,
            region: "ap-guangzhou",
        });
    });

    it("yandex uses the fixed global endpoint and defaults the signing region", () => {
        expect(yandex({ ...credentials })).toStrictEqual({
            credentials,
            endpoint: "https://storage.yandexcloud.net",
            forcePathStyle: false,
            region: "ru-central1",
        });
    });

    it.each([
        ["scaleway", () => scaleway({ ...credentials } as never)],
        ["exoscale", () => exoscale({ ...credentials } as never)],
        ["ibm-cos", () => ibmCos({ ...credentials } as never)],
        ["oracle-cloud", () => oracleCloud({ ...credentials, namespace: "ns" } as never)],
        ["ovhcloud", () => ovhCloud({ ...credentials } as never)],
        ["alibaba", () => alibaba({ ...credentials } as never)],
        ["tencent", () => tencent({ ...credentials } as never)],
    ])("%s does not fall back to AWS_REGION for the hostname segment", (_name, build) => {
        process.env.AWS_REGION = "us-east-1";

        expect(build).toThrow(/Missing required parameters/);
    });
});
