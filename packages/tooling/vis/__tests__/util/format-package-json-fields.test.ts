import { describe, expect, it } from "vitest";

import { formatPackageJsonFields } from "../../src/util/format-package-json-fields";

describe(formatPackageJsonFields, () => {
    describe("formatBugs", () => {
        it("should collapse bugs to a string when url is the only key", () => {
            expect.assertions(2);

            const input = { bugs: { url: "https://example.com/issues" }, name: "x" };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(true);
            expect(result.pkg["bugs"]).toBe("https://example.com/issues");
        });

        it("should preserve the bugs object when email is set", () => {
            expect.assertions(2);

            const input = { bugs: { email: "x@y.test", url: "https://example.com" }, name: "x" };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(false);
            expect(result.pkg["bugs"]).toStrictEqual({ email: "x@y.test", url: "https://example.com" });
        });

        it("should leave a string bugs untouched", () => {
            expect.assertions(2);

            const input = { bugs: "https://already.string", name: "x" };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(false);
            expect(result.pkg["bugs"]).toBe("https://already.string");
        });

        it("should not run when formatBugs is false", () => {
            expect.assertions(2);

            const input = { bugs: { url: "https://example.com/issues" }, name: "x" };
            const result = formatPackageJsonFields(input, { formatBugs: false });

            expect(result.changed).toBe(false);
            expect(result.pkg["bugs"]).toStrictEqual({ url: "https://example.com/issues" });
        });
    });

    describe("formatRepository", () => {
        it("should collapse a GitHub HTTPS repository object to the owner/repo shorthand", () => {
            expect.assertions(2);

            const input = {
                name: "x",
                repository: { type: "git", url: "git+https://github.com/visulima/visulima.git" },
            };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(true);
            expect(result.pkg["repository"]).toBe("visulima/visulima");
        });

        it("should collapse a GitHub SSH repository object to the owner/repo shorthand", () => {
            expect.assertions(2);

            const input = {
                name: "x",
                repository: { type: "git", url: "git+ssh://git@github.com/visulima/visulima.git" },
            };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(true);
            expect(result.pkg["repository"]).toBe("visulima/visulima");
        });

        it("should preserve the repository object when directory is set", () => {
            expect.assertions(2);

            const input = {
                name: "x",
                repository: { directory: "packages/foo", type: "git", url: "git+https://github.com/visulima/visulima.git" },
            };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(false);
            expect(result.pkg["repository"]).toStrictEqual({
                directory: "packages/foo",
                type: "git",
                url: "git+https://github.com/visulima/visulima.git",
            });
        });

        it("should leave non-GitHub URLs untouched", () => {
            expect.assertions(2);

            const input = {
                name: "x",
                repository: { type: "git", url: "git+https://gitlab.com/visulima/visulima.git" },
            };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(false);
            expect(result.pkg["repository"]).toStrictEqual({
                type: "git",
                url: "git+https://gitlab.com/visulima/visulima.git",
            });
        });

        it("should not run when formatRepository is false", () => {
            expect.assertions(2);

            const input = {
                name: "x",
                repository: { type: "git", url: "git+https://github.com/visulima/visulima.git" },
            };
            const result = formatPackageJsonFields(input, { formatRepository: false });

            expect(result.changed).toBe(false);
            expect(result.pkg["repository"]).toStrictEqual({
                type: "git",
                url: "git+https://github.com/visulima/visulima.git",
            });
        });
    });

    describe("sortExports", () => {
        it("should order condition keys by canonical sequence", () => {
            expect.assertions(2);

            const input = {
                exports: {
                    ".": {
                        default: "./dist/index.js",
                        import: "./dist/index.mjs",
                        require: "./dist/index.cjs",
                        types: "./dist/index.d.ts",
                    },
                },
                name: "x",
            };
            const result = formatPackageJsonFields(input, {});
            const conditionKeys = Object.keys((result.pkg["exports"] as Record<string, Record<string, string>>)["."] ?? {});

            expect(result.changed).toBe(true);
            expect(conditionKeys).toStrictEqual(["types", "import", "require", "default"]);
        });

        it("should append unknown keys after canonical keys", () => {
            expect.assertions(2);

            const input = {
                exports: {
                    ".": {
                        custom: "./dist/custom.js",
                        default: "./dist/index.js",
                        types: "./dist/index.d.ts",
                    },
                },
                name: "x",
            };
            const result = formatPackageJsonFields(input, {});
            const conditionKeys = Object.keys((result.pkg["exports"] as Record<string, Record<string, string>>)["."] ?? {});

            expect(result.changed).toBe(true);
            expect(conditionKeys).toStrictEqual(["types", "default", "custom"]);
        });

        it("should leave already-canonical exports unchanged", () => {
            expect.assertions(1);

            const input = {
                exports: {
                    ".": {
                        types: "./dist/index.d.ts",
                        // eslint-disable-next-line perfectionist/sort-objects
                        import: "./dist/index.mjs",
                        // eslint-disable-next-line perfectionist/sort-objects
                        default: "./dist/index.js",
                    },
                },
                name: "x",
            };
            const result = formatPackageJsonFields(input, {});

            expect(result.changed).toBe(false);
        });

        it("should recurse through nested condition objects", () => {
            expect.assertions(2);

            const input = {
                exports: {
                    ".": {
                        import: { default: "./dist/index.mjs", types: "./dist/index.d.mts" },
                        require: { default: "./dist/index.cjs", types: "./dist/index.d.cts" },
                    },
                },
                name: "x",
            };
            const result = formatPackageJsonFields(input, {});
            const top = Object.keys((result.pkg["exports"] as Record<string, Record<string, unknown>>)["."] ?? {});
            const nested = Object.keys((result.pkg["exports"] as Record<string, Record<string, Record<string, unknown>>>)["."]?.["import"] ?? {});

            expect(top).toStrictEqual(["import", "require"]);
            expect(nested).toStrictEqual(["types", "default"]);
        });

        it("should not run when sortExports is false", () => {
            expect.assertions(1);

            const input = {
                exports: {
                    ".": {
                        default: "./dist/index.js",
                        types: "./dist/index.d.ts",
                    },
                },
                name: "x",
            };
            const result = formatPackageJsonFields(input, { sortExports: false });
            const conditionKeys = Object.keys((result.pkg["exports"] as Record<string, Record<string, string>>)["."] ?? {});

            expect(conditionKeys).toStrictEqual(["default", "types"]);
        });
    });

    describe("immutability", () => {
        it("should not mutate the input object", () => {
            expect.assertions(2);

            const input = { bugs: { url: "https://example.com/issues" }, name: "x" };
            const snapshot = JSON.stringify(input);
            const result = formatPackageJsonFields(input, {});

            expect(JSON.stringify(input)).toBe(snapshot);
            expect(result.pkg).not.toBe(input);
        });
    });
});
