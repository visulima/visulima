import { describe, expect, it } from "vitest";

import { isLockFile, isNotAlphanumericString, isPotentialUuid, isSequentialString } from "../src/heuristics";

describe(isLockFile, () => {
    it.each([
        ["yarn.lock", true],
        ["package-lock.json", true],
        ["pnpm-lock.yaml", true],
        ["pnpm-lock.yml", true],
        ["bun.lock", true],
        ["bun.lockb", true],
        ["npm-shrinkwrap.json", true],
        ["Cargo.lock", true],
        ["go.sum", true],
        ["Gemfile.lock", true],
        ["Pipfile.lock", true],
        ["poetry.lock", true],
        ["uv.lock", true],
        ["pdm.lock", true],
        ["composer.lock", true],
        ["mix.lock", true],
        ["pubspec.lock", true],
        ["flake.lock", true],
        ["gradle.lockfile", true],
        [".terraform.lock.hcl", true],
        ["packages/foo/pnpm-lock.yaml", true],
        ["apps/web/package-lock.json", true],
        ["src/index.ts", false],
        ["README.lock", false],
        ["", false],
    ])("returns %s for %s", (path, expected) => {
        expect.assertions(1);
        expect(isLockFile(path)).toBe(expected);
    });
});

describe(isSequentialString, () => {
    it.each([
        ["abcdefgh", true],
        ["ABCDEFGH", true],
        ["12345678", true],
        ["AAAAAAAA", true],
        ["aaaaaaaaa", true],
        ["ab123456cd", false],
        ["", false],
        ["short", false],
        // Real credential shape — must not trip.
        ["AKIAIOSFODNN7EXAMPLE", false],
        ["ghp_1234567890abcdef", false],
    ])("returns %s for %j", (secret, expected) => {
        expect.assertions(1);
        expect(isSequentialString(secret)).toBe(expected);
    });
});

describe(isPotentialUuid, () => {
    it.each([
        ["123e4567-e89b-12d3-a456-426614174000", true],
        ["00000000-0000-0000-0000-000000000000", true],
        ["123E4567-E89B-12D3-A456-426614174000", true],
        ["not-a-uuid", false],
        ["", false],
        ["123e4567-e89b-12d3-a456", false],
        ["AKIAIOSFODNN7EXAMPLE", false],
    ])("returns %s for %j", (secret, expected) => {
        expect.assertions(1);
        expect(isPotentialUuid(secret)).toBe(expected);
    });
});

describe(isNotAlphanumericString, () => {
    it.each([
        ["*****", true],
        ["------", true],
        ["//////", true],
        ["   ", true],
        // Empty string is the path-only finding sentinel — must short-circuit
        // to `false` so path-based exposure rules survive the heuristic pass.
        ["", false],
        ["has1digit", false],
        ["has-letter", false],
        ["__foo__", false],
        ["*1*", false],
    ])("returns %s for %j", (secret, expected) => {
        expect.assertions(1);
        expect(isNotAlphanumericString(secret)).toBe(expected);
    });
});
