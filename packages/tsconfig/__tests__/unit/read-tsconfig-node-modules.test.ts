/* eslint-disable unicorn/no-null */

/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig/blob/develop/tests/specs/parse-tsconfig/extends/resolves/node-modules.spec.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";
import { execaNode } from "execa";
import { temporaryDirectory } from "tempy";
import { version as tsVersion } from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readTsConfig } from "../../src/read-tsconfig";
import { esc, getTscTsconfig, parseVersion } from "../helpers";

const typescriptVersion = parseVersion(tsVersion);

if (!typescriptVersion) {
    throw new Error(`Invalid TypeScript version format: ${tsVersion}`);
}

describe("node_modules", () => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();

        writeFileSync(join(distribution, "file.ts"), "");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("prefers file over package", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "node_modules", "dep.json"), {
            compilerOptions: {
                jsx: "react-native",
            },
        });
        writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
            compilerOptions: {
                jsx: "react",
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "dep",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    describe("extends dependency", () => {
        it("implicit tsconfig.json", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "node_modules", "dep", "index.js"), "require(\"fs\")");
            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                main: "./index.js",
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("without package.json", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("ignores invalid package.json", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "node_modules", "dep", "package.json"), "invalid json");
            writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "react",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("ignores invalid package.json 2", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, "node_modules", "dep", "package.json"), "invalid json");
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "react",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("empty package.json", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "custom.json"), {
                compilerOptions: {
                    module: "node16",
                },
            });
            writeFileSync(join(distribution, "node_modules", "dep", "package.json"), "");
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    module: "commonjs",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/custom.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("empty object package.json", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "custom.json"), {
                compilerOptions: {
                    module: "node16",
                },
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {});
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    module: "commonjs",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/custom.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    describe("dependency file", () => {
        it("direct tsconfig.json", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "some-file.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/some-file.json",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("implicit .json extension", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "react-native.json"), {
                compilerOptions: {
                    jsx: "react-native",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/react-native",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("prefers implicit .json over directory", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "config-package", "lib", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "react-jsxdev",
                },
            });
            writeJsonSync(join(distribution, "node_modules", "config-package", "lib.json"), {
                compilerOptions: {
                    jsx: "react-jsx",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "config-package/lib",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("extensionless file should not work", async () => {
            expect.assertions(2);

            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig"), {
                compilerOptions: {
                    jsx: "react-native",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/tsconfig",
            });

            await expect(getTscTsconfig(distribution)).rejects.toThrow("File 'dep/tsconfig' not found");
            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for 'dep/tsconfig' found.");
        });

        it("arbitrary extension should not work", async () => {
            expect.assertions(2);

            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.ts"), {
                compilerOptions: {
                    jsx: "react-native",
                    strict: true,
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/tsconfig.ts",
            });

            await expect(getTscTsconfig(distribution)).rejects.toThrow("File 'dep/tsconfig.ts' not found");
            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for 'dep/tsconfig.ts' found.");
        });
    });

    it("directory named \"tsconfig.json\"", async () => {
        expect.assertions(1);

        writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json", "tsconfig.json"), {
            compilerOptions: {
                jsx: "react-native",
                strict: true,
            },
        });
        writeJsonSync(join(distribution, "tsconfig.json"), {
            extends: "dep/tsconfig.json",
        });

        const expectedTsconfig = await getTscTsconfig(distribution);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    it("extends dependency package far", async () => {
        expect.assertions(1);

        const fixturePath = join(distribution, "nested", "nested", "nested");

        writeJsonSync(join(fixturePath, "tsconfig.json"), {
            extends: "dep/tsconfig.json",
        });
        writeFileSync(join(fixturePath, "file.ts"), "");
        writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
            compilerOptions: {
                jsx: "react",
                strict: true,
            },
        });

        const expectedTsconfig = await getTscTsconfig(fixturePath);

        delete expectedTsconfig.files;

        const tsconfig = readTsConfig(join(fixturePath, "tsconfig.json"), { tscCompatible: typescriptVersion });

        expect(tsconfig).toStrictEqual(expectedTsconfig);
    });

    // https://github.com/privatenumber/get-tsconfig/issues/76
    it("should resolves config in parent node_modules", async () => {
        expect.assertions(1);

        const fixturePath = join(distribution, "library");

        writeJsonSync(join(fixturePath, "tsconfig.json"), {
            extends: "@monorepo/tsconfig/tsconfig.base.json",
            include: ["src"],
        });
        writeJsonSync(join(distribution, "node_modules", "@monorepo", "tsconfig", "tsconfig.base.json"), {
            compilerOptions: {
                module: "commonjs",
            },
        });
        writeFileSync(join(fixturePath, "src", "a.ts"), "");
        writeFileSync(join(fixturePath, "src", "b.ts"), "");
        writeFileSync(join(fixturePath, "src", "c.ts"), "");

        const originalCwd = process.cwd();

        try {
            process.chdir(fixturePath);

            const expectedTsconfig = await getTscTsconfig(".");

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig("./tsconfig.json");

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        } finally {
            process.chdir(originalCwd);
        }
    });

    describe("package.json#tsconfig", () => {
        it("package.json#tsconfig", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                tsconfig: "./some-config.json",
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            // should be ignored
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("reads nested package.json#tsconfig", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "some-directory", "package.json"), {
                // This is ignored because its not at root
                exports: {
                    "./*": null,
                },
                tsconfig: "./some-config.json",
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "some-directory", "some-config.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            // should be ignored
            writeJsonSync(join(distribution, "node_modules", "dep", "some-directory", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/some-directory",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });

    // TODO: test pnp package exports
    it("yarn pnp", async () => {
        expect.assertions(1);

        const { stdout } = await execaNode("./index.js", [], {
            cwd: join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "read-tsconfig", "yarn-pnp"),
            nodeOptions: ["--require", "./.pnp.cjs"],
            reject: false,
        });

        expect(esc(stripVTControlCharacters(stdout))).toBe(
            esc(
                [
                    "{ compilerOptions: { strict: true, jsx: 'react' } }",
                    "{ compilerOptions: { strict: true, jsx: 'react' } }",
                    "{ compilerOptions: { strict: true, jsx: 'react' } }",
                    "{ compilerOptions: { strict: true, jsx: 'react' } }",
                    "Error: ENOENT: No such file or directory, for 'non-existent-package' found.",
                    "Error: ENOENT: No such file or directory, for 'fs/promises' found.",
                ].join("\n"),
            ),
        );
    });

    describe("package.json exports", () => {
        it("main", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                exports: "./some-config.json",
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            // should be ignored
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("subpath", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                exports: { "./config": "./some-config.json" },
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            // should be ignored
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/config",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        describe("conditions", () => {
            it("require", async () => {
                expect.assertions(1);

                writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                    exports: {
                        require: "./some-config.json",
                    },
                });
                writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                    compilerOptions: {
                        jsx: "react",
                        strict: true,
                    },
                });
                // should be ignored
                writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                    compilerOptions: {
                        jsx: "preserve",
                    },
                });
                writeJsonSync(join(distribution, "tsconfig.json"), {
                    extends: "dep",
                });

                const expectedTsconfig = await getTscTsconfig(distribution);

                delete expectedTsconfig.files;

                const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

                expect(tsconfig).toStrictEqual(expectedTsconfig);
            });

            it("types", async () => {
                expect.assertions(1);

                writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                    exports: {
                        types: "./some-config.json",
                    },
                });
                writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                    compilerOptions: {
                        jsx: "react",
                        strict: true,
                    },
                });
                // should be ignored
                writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                    compilerOptions: {
                        jsx: "preserve",
                    },
                });
                writeJsonSync(join(distribution, "tsconfig.json"), {
                    extends: "dep",
                });

                const expectedTsconfig = await getTscTsconfig(distribution);

                delete expectedTsconfig.files;

                const tsconfig = readTsConfig(join(distribution, "tsconfig.json"), { tscCompatible: typescriptVersion });

                expect(tsconfig).toStrictEqual(expectedTsconfig);
            });

            it("missing condition should fail", async () => {
                expect.assertions(2);

                writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                    exports: {
                        asdf: "./some-config.json",
                    },
                });
                writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                    compilerOptions: {
                        jsx: "react",
                        strict: true,
                    },
                });
                // should be ignored
                writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                    compilerOptions: {
                        jsx: "preserve",
                    },
                });
                writeJsonSync(join(distribution, "tsconfig.json"), {
                    extends: "dep",
                });

                await expect(getTscTsconfig(distribution)).rejects.toThrow("File 'dep' not found.");
                expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for 'dep' found.");
            });
        });

        it("missing subpath should fail", async () => {
            expect.assertions(2);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                exports: {
                    "./config": "./some-config.json",
                },
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "some-config.json"), {
                compilerOptions: {
                    jsx: "react",
                    strict: true,
                },
            });
            // should be ignored
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/missing",
            });

            await expect(getTscTsconfig(distribution)).rejects.toThrow("File 'dep/missing' not found.");
            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for 'dep/missing' found.");
        });

        // Seems like a TypeScript bug
        it("null exports should resolve tsconfig.json", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                exports: null,
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("null exports should resolve tsconfig.json in directory", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                exports: null,
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "some-directory", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/some-directory",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });

        it("path block should not resolve tsconfig.json", async () => {
            expect.assertions(2);

            writeJsonSync(join(distribution, "node_modules", "dep", "package.json"), {
                exports: {
                    "./*": null,
                },
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep",
            });

            await expect(getTscTsconfig(distribution)).rejects.toThrow("File 'dep' not found.");
            expect(() => readTsConfig(join(distribution, "tsconfig.json"))).toThrow("ENOENT: No such file or directory, for 'dep' found.");
        });

        it("package.json ignored in nested directory", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "node_modules", "dep", "a", "package.json"), {
                exports: {
                    "./*": null,
                },
            });
            writeJsonSync(join(distribution, "node_modules", "dep", "a", "tsconfig.json"), {
                compilerOptions: {
                    jsx: "preserve",
                },
            });
            writeJsonSync(join(distribution, "tsconfig.json"), {
                extends: "dep/a",
            });

            const expectedTsconfig = await getTscTsconfig(distribution);

            delete expectedTsconfig.files;

            const tsconfig = readTsConfig(join(distribution, "tsconfig.json"));

            expect(tsconfig).toStrictEqual(expectedTsconfig);
        });
    });
});
