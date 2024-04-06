import type { ExecaError } from "execa";
import { describe, expect, it } from "vitest";
import { findTsConfigSync } from "@visulima/package";
import createPathsMatcher from "../../../../../../../src/builder/rollup/plugins/tsconfig-paths/paths-matcher";
import { createTsconfigJson, getTscResolution } from "../utils.js";

/**
 * Resolution is tested against the TypeScript compiler using:
 * npx tsc --traceResolution --noEmit
 */

describe("paths", () => {
    describe("error cases", () => {
        it("no baseUrl or paths should be fine", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    compilerOptions: {},
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();
            expect(createPathsMatcher(tsconfig)).toBeNull();
        });

        it("no baseUrl nor relative paths", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        paths: {
                            "@": ["src"],
                        },
                    },
                }),
            });

            let throwsError = false;
            const errorMessage = "Non-relative paths are not allowed when 'baseUrl' is not set. Did you forget a leading './'?";
            try {
                await getTscResolution("@", fixture.path);
            } catch (error) {
                throwsError = true;
                expect((error as ExecaError).stdout).toMatch(errorMessage);
            }
            expect(throwsError).toBeTruthy();

            const tsconfig = findTsConfigSync(fixture.path);
            expect(tsconfig).not.toBeNull();
            expect(() => createPathsMatcher(tsconfig!)).toThrow(errorMessage);
        });

        it("no baseUrl nor relative paths in extends", async () => {
            const fixture = await createFixture({
                "some-dir/tsconfig.json": createTsconfigJson({
                    extends: "../some-dir2/tsconfig.json",
                }),
                "some-dir2/tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        paths: {
                            "@": ["src"],
                        },
                    },
                }),
                "tsconfig.json": createTsconfigJson({
                    extends: "./some-dir/tsconfig.json",
                }),
            });

            let throwsError = false;
            const errorMessage = "Non-relative paths are not allowed when 'baseUrl' is not set. Did you forget a leading './'?";
            try {
                await getTscResolution("@", fixture.path);
            } catch (error) {
                throwsError = true;
                expect((error as ExecaError).stdout).toMatch(errorMessage);
            }
            expect(throwsError).toBeTruthy();

            const tsconfig = findTsConfigSync(fixture.path);
            expect(tsconfig).not.toBeNull();
            expect(() => createPathsMatcher(tsconfig!)).toThrow(errorMessage);
        });

        it("multiple * in pattern", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        paths: {
                            "a/*/*": ["src"],
                        },
                    },
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();
            expect(() => createPathsMatcher(tsconfig!)).toThrow("Pattern 'a/*/*' can have at most one '*' character.");
        });

        it("multiple * in substitution", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        paths: {
                            "a/*": ["*/*"],
                        },
                    },
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();
            expect(() => createPathsMatcher(tsconfig!)).toThrow("Substitution '*/*' in pattern 'a/*' can have at most one '*' character.");
        });

        it("no match", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        paths: {
                            "no-match": ["./b"],
                        },
                    },
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig!)!;

            expect(matcher).not.toBeNull();
            expect(matcher("specifier")).toStrictEqual([]);
        });
    });

    describe("baseUrl", () => {
        it("baseUrl", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        baseUrl: ".",
                    },
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig!)!;

            expect(matcher).not.toBeNull();

            const resolvedAttempts = await getTscResolution("exactMatch", fixture.path);

            expect(matcher("exactMatch")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);
        });

        it("inherited from extends", async () => {
            const fixture = await createFixture({
                "some-dir/tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        baseUrl: "..",
                        paths: {
                            $lib: ["src/lib"],
                            "$lib/*": ["src/lib/*"],
                        },
                    },
                }),
                "src/lib/file": "",
                "tsconfig.json": createTsconfigJson({
                    extends: "./some-dir/tsconfig.json",
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig!)!;

            expect(matcher).not.toBeNull();

            const resolvedAttempts = await getTscResolution("$lib", fixture.path);

            expect(matcher("$lib")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);
        });

        it("absolute path", async () => {
            const fixture = await createFixture();
            await fixture.writeFile(
                "tsconfig.json",
                createTsconfigJson({
                    compilerOptions: {
                        baseUrl: fixture.path,
                    },
                }),
            );

            const tsconfig = findTsConfigSync(fixture.path);
            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig!)!;
            expect(matcher).not.toBeNull();

            const resolvedAttempts = await getTscResolution("exactMatch", fixture.path);
            expect(matcher("exactMatch")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);
        });
    });

    it("exact match", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        exactMatch: ["./b"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(matcher).not.toBeNull();

        const resolvedAttempts = await getTscResolution("exactMatch", fixture.path);
        expect(matcher("exactMatch")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    // #17
    it("exact match with parent path", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        exactMatch: ["../src"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(matcher).not.toBeNull();

        const resolvedAttempts = await getTscResolution("exactMatch", fixture.path);
        expect(matcher("exactMatch")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    it("exact match with literal wildcard", async () => {
        const fixture = await createFixture({
            "b/file": "",
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        exactMatch: ["./b/*"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(tsconfig).not.toBeNull();

        const resolvedAttempts = await getTscResolution("exactMatch", fixture.path);
        expect(matcher("exactMatch")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    it("prefix match", async () => {
        const fixture = await createFixture({
            "prefixed/specifier": "",
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        "prefix-*": ["./prefixed/*"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(tsconfig).not.toBeNull();

        const resolvedAttempts = await getTscResolution("prefix-specifier", fixture.path);
        expect(matcher("prefix-specifier")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    it("suffix match", async () => {
        const fixture = await createFixture({
            "suffixed/specifier": "",
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        "*-suffix": ["./suffixed/*"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(tsconfig).not.toBeNull();

        const resolvedAttempts = await getTscResolution("specifier-suffix", fixture.path);
        expect(matcher("specifier-suffix")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    it("doesnt match current directory", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        ".": ["./a"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;

        expect(tsconfig).not.toBeNull();
        expect(matcher(".")).toStrictEqual([]);

        await fixture.rm();
    });

    it("doesnt match parent directory", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        "..": ["./a"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;

        expect(tsconfig).not.toBeNull();
        expect(matcher("..")).toStrictEqual([]);

        await fixture.rm();
    });

    it("doesnt match relative paths", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        "./relative": ["./a"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;

        expect(tsconfig).not.toBeNull();
        expect(matcher("./relative")).toStrictEqual([]);

        await fixture.rm();
    });

    it("matches absolute paths", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        "/absolute": ["./a"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(tsconfig).not.toBeNull();

        const resolvedAttempts = await getTscResolution("/absolute", fixture.path);
        expect(matcher("/absolute")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    it("matches absolute target paths", async () => {
        const fixture = await createFixture();

        await fixture.writeFile(
            "tsconfig.json",
            createTsconfigJson({
                compilerOptions: {
                    baseUrl: fixture.path,
                    paths: {
                        dir: [path.join(fixture.path, "dir")],
                    },
                },
            }),
        );

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(tsconfig).not.toBeNull();

        const resolvedAttempts = await getTscResolution("dir", fixture.path);
        expect(matcher("dir")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    it("matches path that starts with .", async () => {
        const fixture = await createFixture({
            "tsconfig.json": createTsconfigJson({
                compilerOptions: {
                    paths: {
                        ".src": ["./src"],
                    },
                },
            }),
        });

        const tsconfig = findTsConfigSync(fixture.path);
        expect(tsconfig).not.toBeNull();

        const matcher = createPathsMatcher(tsconfig!)!;
        expect(tsconfig).not.toBeNull();

        const resolvedAttempts = await getTscResolution(".src", fixture.path);
        expect(matcher(".src")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);

        await fixture.rm();
    });

    describe("extends w/ no baseUrl", () => {
        it("extended config should resolve relative to self", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    extends: "./tsconfigs/tsconfig.json",
                }),
                tsconfigs: {
                    "tsconfig.json": createTsconfigJson({
                        compilerOptions: {
                            paths: {
                                "@": ["./file"],
                            },
                        },
                    }),
                },
            });

            const tsconfig = findTsConfigSync(fixture.path);
            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig!)!;
            expect(tsconfig).not.toBeNull();

            const resolvedAttempts = await getTscResolution("@", fixture.path);
            expect(matcher("@")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);
        });

        it("extended config should implicitly resolve paths from self", async () => {
            const fixture = await createFixture({
                "tsconfig.json": createTsconfigJson({
                    extends: "./tsconfigs/tsconfig.json",
                }),
                tsconfigs: {
                    "tsconfig.json": createTsconfigJson({
                        compilerOptions: {
                            paths: {
                                "@": ["./file"],
                            },
                        },
                    }),
                },
            });

            const tsconfig = findTsConfigSync(fixture.path);
            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig!)!;
            expect(tsconfig).not.toBeNull();

            const resolvedAttempts = await getTscResolution("@", fixture.path);
            expect(matcher("@")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);
        });

        it("extended config should implicitly resolve paths from self - complex", async () => {
            const fixture = await createFixture({
                "file.ts": "",
                "some-dir/tsconfig.json": createTsconfigJson({
                    extends: "../some-dir2/tsconfig.json",
                }),
                "some-dir2/tsconfig.json": createTsconfigJson({
                    compilerOptions: {
                        paths: {
                            "@": ["./a"],
                        },
                    },
                }),
                "tsconfig.json": createTsconfigJson({
                    extends: "./some-dir/tsconfig.json",
                }),
            });

            const tsconfig = findTsConfigSync(fixture.path);

            expect(tsconfig).not.toBeNull();

            const matcher = createPathsMatcher(tsconfig);

            expect(tsconfig).not.toBeNull();

            const resolvedAttempts = await getTscResolution("@", fixture.path);

            expect(matcher("@")).toStrictEqual([resolvedAttempts[0].filePath.slice(0, -3)]);
        });
    });
});
