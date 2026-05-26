import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseEarlyCaCert } from "../../src/util/ca-cert";

describe(parseEarlyCaCert, () => {
    it("should return undefined when --ca-cert is absent", () => {
        expect.assertions(1);

        expect(parseEarlyCaCert(["node", "vis", "audit"])).toBeUndefined();
    });

    it("should pick up `--ca-cert <path>` as separate argv tokens", () => {
        expect.assertions(1);

        expect(parseEarlyCaCert(["node", "vis", "audit", "--ca-cert", "ca.pem"])).toBe(resolve("ca.pem"));
    });

    it("should pick up `--ca-cert=<path>` glued syntax", () => {
        expect.assertions(1);

        expect(parseEarlyCaCert(["node", "vis", "audit", "--ca-cert=/etc/ssl/ca.pem"])).toBe(resolve("/etc/ssl/ca.pem"));
    });

    it("should return undefined when --ca-cert is followed by another flag", () => {
        expect.assertions(1);

        // `--ca-cert --offline` should not adopt `--offline` as the cert path.
        expect(parseEarlyCaCert(["node", "vis", "audit", "--ca-cert", "--offline"])).toBeUndefined();
    });

    it("should return undefined when --ca-cert is the final argv with no value", () => {
        expect.assertions(1);

        expect(parseEarlyCaCert(["node", "vis", "audit", "--ca-cert"])).toBeUndefined();
    });

    it("should return undefined when --ca-cert= has an empty value", () => {
        expect.assertions(1);

        expect(parseEarlyCaCert(["node", "vis", "audit", "--ca-cert="])).toBeUndefined();
    });

    it("should resolve relative paths against the cwd", () => {
        expect.assertions(1);

        expect(parseEarlyCaCert(["node", "vis", "audit", "--ca-cert", "./certs/corp.pem"])).toBe(resolve("./certs/corp.pem"));
    });
});
