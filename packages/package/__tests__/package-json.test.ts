import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { findPackageJson } from "../src/package-json";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__", "package");

describe("package-json", () => {
    it("should return the content of the found package.json", async () => {
        expect.assertions(3);

        const result = await findPackageJson(fixturePath);

        expect(result.packageJson).toBeTypeOf("object");
        expect(result.packageJson.name).toBe("nextjs_12_example_connect");
        expect(result.path).toBe(join(fixturePath, "package.json"));
    });
});
