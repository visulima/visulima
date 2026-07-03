import { describe, expect, it } from "vitest";

import { checkChecksum, renderChecksumTemplate, ruleRegexToJs } from "../src/checksum";

// Real kingfisher rule fixtures — taken from the YAML `examples:` so anyone
// can verify the checksum math by eye against the upstream provider spec.
const ZUPLO = {
    match: "zpka_3e6c4f7d39954ca29353b7ab88589b64_de26cd55",
    pattern: "(?xi)\n\\b\n(\n  zpka_(?P<body>[a-z0-9]{32})_(?P<checksum>[0-9a-f]{8})\n)\n",
    spec: {
        actual: { requires_capture: "checksum", template: "{{ CHECKSUM | downcase }}" },
        expected: "{{ BODY | crc32_hex }}",
    },
};

const VERCEL = {
    match: "vcp_35UYJwYZDigYATKhxJUAhPqRhit2Xe3dtiG60LsUTHeklEXDQ94Jafpu",
    pattern: "(?x)\n\\b\n(\n  vcp_(?P<body>[A-Za-z0-9_-]{50})(?P<checksum>[A-Za-z0-9]{6})\n)\n\\b\n",
    spec: {
        actual: { template: "{{ checksum }}" },
        expected: "{{ body | crc32 | base62: 6 }}",
    },
};

describe(ruleRegexToJs, () => {
    it("strips (?x) free-spacing whitespace and comments", () => {
        expect.assertions(1);

        const re = ruleRegexToJs("(?x)\n\\b  hello # comment\n  world");

        expect(re.source).toBe(String.raw`\bhelloworld`);
    });

    it("converts Python-style (?P<name>...) to JS (?<name>...)", () => {
        expect.assertions(2);

        const re = ruleRegexToJs("(?P<body>[a-z]+)");
        const matched = re.exec("hello");

        expect(re.source).toBe("(?<body>[a-z]+)");
        expect(matched?.groups?.["body"]).toBe("hello");
    });
});

describe(renderChecksumTemplate, () => {
    it("base62(crc32('abc')) matches the expected encoding", () => {
        expect.assertions(1);

        const out = renderChecksumTemplate("{{ body | crc32 | base62: 6 }}", { body: "abc" });

        expect(out).toMatch(/^[0-9A-Z]{6}$/i);
    });

    it("crc32_hex produces 8 lowercase hex chars", () => {
        expect.assertions(1);

        const out = renderChecksumTemplate("{{ body | crc32_hex }}", { body: "hello" });

        expect(out).toMatch(/^[0-9a-f]{8}$/);
    });

    it("returns undefined on unknown filter", () => {
        expect.assertions(1);

        expect(renderChecksumTemplate("{{ body | unknownfilter }}", { body: "x" })).toBeUndefined();
    });

    it("base36 encodes the crc32 into lowercase base36", () => {
        expect.assertions(1);

        const out = renderChecksumTemplate("{{ body | crc32 | base36: 7 }}", { body: "hello" });

        expect(out).toMatch(/^[0-9a-z]{7}$/);
    });

    it("crc32_le_b64 truncates the little-endian base64 digest to the requested width", () => {
        expect.assertions(2);

        const full = renderChecksumTemplate("{{ body | crc32_le_b64 }}", { body: "hello" });
        const truncated = renderChecksumTemplate("{{ body | crc32_le_b64: 6 }}", { body: "hello" });

        expect(full).toMatch(/^[A-Z0-9+/]+=*$/i);
        expect(truncated).toHaveLength(6);
    });

    it("applies the upcase filter", () => {
        expect.assertions(1);

        expect(renderChecksumTemplate("{{ body | upcase }}", { body: "abc" })).toBe("ABC");
    });

    it("encodes zero as a zero-padded run for the configured width", () => {
        expect.assertions(1);

        // `asNumber("0")` is 0, so `encodeBase` takes the early `n === 0` branch.
        expect(renderChecksumTemplate("{{ body | base62: 4 }}", { body: "0" })).toBe("0000");
    });
});

describe("checkChecksum — real kingfisher rules", () => {
    it("accepts the Zuplo example from the rule YAML", () => {
        expect.assertions(1);

        expect(checkChecksum(ZUPLO.match, ZUPLO.pattern, ZUPLO.spec)).toBe(true);
    });

    it("accepts the Vercel example from the rule YAML", () => {
        expect.assertions(1);

        expect(checkChecksum(VERCEL.match, VERCEL.pattern, VERCEL.spec)).toBe(true);
    });

    it("rejects a Zuplo-shaped token whose checksum bytes are wrong", () => {
        expect.assertions(1);

        const wrongMatch = "zpka_3e6c4f7d39954ca29353b7ab88589b64_deadbeef";

        expect(checkChecksum(wrongMatch, ZUPLO.pattern, ZUPLO.spec)).toBe(false);
    });

    it("rejects a Vercel-shaped token whose stored checksum is wrong", () => {
        expect.assertions(1);

        // Original: body="35UYJwYZDigYATKhxJUAhPqRhit2Xe3dtiG60LsUTHeklEXDQ9" checksum="4Jafpu".
        // Replace the checksum with six distinct chars that can't be the CRC32 of the body.
        const wrongMatch = "vcp_35UYJwYZDigYATKhxJUAhPqRhit2Xe3dtiG60LsUTHeklEXDQ9ABCDEF";

        expect(checkChecksum(wrongMatch, VERCEL.pattern, VERCEL.spec)).toBe(false);
    });

    it("returns undefined when the pattern has no named capture (template can't resolve)", () => {
        expect.assertions(1);

        const verdict = checkChecksum("anything", "(?<other>[a-z]+)", ZUPLO.spec);

        expect(verdict).toBeUndefined();
    });

    it("returns undefined when the rule pattern can't compile to a JS RegExp", () => {
        expect.assertions(1);

        // An unbalanced group makes `new RegExp` throw; `checkChecksum` swallows
        // it and yields undefined (can't decide → conservative keep).
        expect(checkChecksum("anything", "(unclosed", ZUPLO.spec)).toBeUndefined();
    });

    it("returns undefined when the spec has no actual template or expected value", () => {
        expect.assertions(2);

        expect(checkChecksum(ZUPLO.match, ZUPLO.pattern, { expected: "{{ BODY | crc32_hex }}" })).toBeUndefined();
        expect(checkChecksum(ZUPLO.match, ZUPLO.pattern, { actual: { template: "{{ CHECKSUM }}" }, expected: "" })).toBeUndefined();
    });
});
