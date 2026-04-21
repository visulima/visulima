import { writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    buildInstallInvocation,
    buildUseInvocation,
    detectVersionManager,
    findInstalledManagers,
    parseExpectedTools,
    parseUseArgument,
    satisfies,
} from "../src/toolchain";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "./test-helpers";

let tmpDirectory: string;

beforeEach(() => {
    tmpDirectory = createTemporaryDirectory("vis-toolchain-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmpDirectory);
});

describe(satisfies, () => {
    it("should return true for wildcard and empty ranges", () => {
        expect.assertions(3);

        expect(satisfies("22.1.0", "*")).toBe(true);
        expect(satisfies("22.1.0", "")).toBe(true);
        expect(satisfies("22.1.0", "latest")).toBe(true);
    });

    it("should handle exact version matches", () => {
        expect.assertions(3);

        expect(satisfies("22.1.0", "22.1.0")).toBe(true);
        // "22" is a major-prefix match, so 22.1.0 satisfies it
        expect(satisfies("22.1.0", "22")).toBe(true);
        expect(satisfies("22.1.0", "20.0.0")).toBe(false);
    });

    it("should support >= and compound ranges", () => {
        expect.assertions(3);

        expect(satisfies("22.1.0", ">=22.0.0")).toBe(true);
        expect(satisfies("22.1.0", ">=22.13.0")).toBe(false);
        expect(satisfies("22.13.0", ">=22.0.0 <23.0.0")).toBe(true);
    });

    it("should support caret (^) for same major", () => {
        expect.assertions(3);

        expect(satisfies("22.5.0", "^22.1.0")).toBe(true);
        expect(satisfies("22.5.0", "^22.10.0")).toBe(false);
        expect(satisfies("23.0.0", "^22.1.0")).toBe(false);
    });

    it("should support tilde (~) for same major.minor", () => {
        expect.assertions(2);

        expect(satisfies("22.5.1", "~22.5.0")).toBe(true);
        expect(satisfies("22.6.0", "~22.5.0")).toBe(false);
    });
});

describe(parseUseArgument, () => {
    it("should parse <tool>@<version>", () => {
        expect.assertions(4);

        const spec = parseUseArgument("node@22.13.0");

        expect(spec).toBeDefined();
        expect(spec?.tool).toBe("node");
        expect(spec?.version).toBe("22.13.0");
        expect(spec?.source).toBe("vis.config.ts");
    });

    it("should accept aliases like nodejs", () => {
        expect.assertions(2);

        const spec = parseUseArgument("nodejs@22.0.0");

        expect(spec?.tool).toBe("node");
        expect(spec?.version).toBe("22.0.0");
    });

    it("should reject unknown tools and malformed inputs", () => {
        expect.assertions(3);

        expect(parseUseArgument("foo@1.0.0")).toBeUndefined();
        expect(parseUseArgument("node")).toBeUndefined();
        expect(parseUseArgument("@1.0.0")).toBeUndefined();
    });
});

describe(parseExpectedTools, () => {
    it("should read engines from package.json", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDirectory, "package.json"), JSON.stringify({ engines: { node: ">=22.13.0", pnpm: "10.32.1" } }));

        const specs = parseExpectedTools(tmpDirectory);

        const node = specs.find((s) => s.tool === "node");

        expect(node?.version).toBe(">=22.13.0");

        const pnpm = specs.find((s) => s.tool === "pnpm");

        expect(pnpm?.version).toBe("10.32.1");
    });

    it("should prefer .nvmrc over engines.node", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDirectory, "package.json"), JSON.stringify({ engines: { node: ">=20" } }));
        writeFileSync(join(tmpDirectory, ".nvmrc"), "22.13.0");

        const specs = parseExpectedTools(tmpDirectory);
        const node = specs.find((s) => s.tool === "node");

        expect(node?.version).toBe("22.13.0");
        expect(node?.source).toBe(".nvmrc");
    });

    it("should parse packageManager and strip sha checksums", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDirectory, "package.json"),
            JSON.stringify({ packageManager: "pnpm@10.32.1+sha512.deadbeef" }),
        );

        const specs = parseExpectedTools(tmpDirectory);
        const pnpm = specs.find((s) => s.tool === "pnpm");

        expect(pnpm?.version).toBe("10.32.1");
        expect(pnpm?.source).toBe("packageManager");
    });

    it("should parse .prototools with quoted and unquoted values", () => {
        expect.assertions(3);

        writeFileSync(
            join(tmpDirectory, ".prototools"),
            [
                '# comment line',
                'node = "22.13.0"',
                'pnpm = 10.32.1',
                '[plugins]',
                'foo = "bar"',
                '',
            ].join("\n"),
        );

        const specs = parseExpectedTools(tmpDirectory);

        expect(specs.find((s) => s.tool === "node")?.version).toBe("22.13.0");
        expect(specs.find((s) => s.tool === "pnpm")?.version).toBe("10.32.1");
        // Inside [plugins] section — ignored.
        expect(specs.some((s) => s.tool === "node" && s.source !== ".prototools")).toBe(false);
    });

    it("should parse .mise.toml [tools] section only", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDirectory, ".mise.toml"),
            [
                '[tools]',
                'node = "22.13.0"',
                'python = "3.12"',
                '',
                '[env]',
                'FOO = "bar"',
            ].join("\n"),
        );

        const specs = parseExpectedTools(tmpDirectory);

        expect(specs.find((s) => s.tool === "node")?.version).toBe("22.13.0");
        expect(specs.find((s) => s.tool === "python")?.version).toBe("3.12");
    });

    it("should parse .tool-versions (asdf format)", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDirectory, ".tool-versions"),
            ["node 22.13.0", "python 3.12.0 3.11.0", "# comment"].join("\n"),
        );

        const specs = parseExpectedTools(tmpDirectory);

        expect(specs.find((s) => s.tool === "node")?.version).toBe("22.13.0");
        // Multiple versions on one line — first wins.
        expect(specs.find((s) => s.tool === "python")?.version).toBe("3.12.0");
    });

    it("should let vis.config.ts tools override everything", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDirectory, "package.json"), JSON.stringify({ engines: { node: ">=20" } }));
        writeFileSync(join(tmpDirectory, ".nvmrc"), "22.0.0");

        const specs = parseExpectedTools(tmpDirectory, { tools: { node: "22.15.0" } });
        const node = specs.find((s) => s.tool === "node");

        expect(node?.version).toBe("22.15.0");
        expect(node?.source).toBe("vis.config.ts");
    });

    it("should pick up volta pins from package.json", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDirectory, "package.json"),
            JSON.stringify({ volta: { node: "22.13.0", pnpm: "10.0.0" } }),
        );

        const specs = parseExpectedTools(tmpDirectory);

        expect(specs.find((s) => s.tool === "node")?.source).toBe("volta");
        expect(specs.find((s) => s.tool === "pnpm")?.version).toBe("10.0.0");
    });
});

describe(findInstalledManagers, () => {
    it("should return an empty list when no managers are on PATH or in config", () => {
        expect.assertions(1);

        const originalPath = process.env["PATH"];
        const originalNvmDirectory = process.env["NVM_DIR"];

        try {
            process.env["PATH"] = tmpDirectory;
            delete process.env["NVM_DIR"];

            const managers = findInstalledManagers(tmpDirectory);

            expect(managers).toHaveLength(0);
        } finally {
            if (originalPath === undefined) {
                delete process.env["PATH"];
            } else {
                process.env["PATH"] = originalPath;
            }

            if (originalNvmDirectory === undefined) {
                delete process.env["NVM_DIR"];
            } else {
                process.env["NVM_DIR"] = originalNvmDirectory;
            }
        }
    });

    it("should detect a manager from its workspace config file even if the binary is missing", () => {
        expect.assertions(3);

        writeFileSync(join(tmpDirectory, ".prototools"), 'node = "22.13.0"\n');

        const originalPath = process.env["PATH"];

        try {
            process.env["PATH"] = tmpDirectory;

            const managers = findInstalledManagers(tmpDirectory);
            const proto = managers.find((m) => m.name === "proto");

            expect(proto).toBeDefined();
            expect(proto?.installed).toBe(false);
            expect(proto?.configFiles).toContain(".prototools");
        } finally {
            if (originalPath === undefined) {
                delete process.env["PATH"];
            } else {
                process.env["PATH"] = originalPath;
            }
        }
    });

    it("should detect volta from a volta field in package.json", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDirectory, "package.json"), JSON.stringify({ volta: { node: "22.13.0" } }));

        const originalPath = process.env["PATH"];

        try {
            process.env["PATH"] = tmpDirectory;

            const managers = findInstalledManagers(tmpDirectory);
            const volta = managers.find((m) => m.name === "volta");

            expect(volta).toBeDefined();
            expect(volta?.configFiles).toContain("package.json");
        } finally {
            if (originalPath === undefined) {
                delete process.env["PATH"];
            } else {
                process.env["PATH"] = originalPath;
            }
        }
    });
});

describe(detectVersionManager, () => {
    it("should return { name: 'none' } when nothing is detected", () => {
        expect.assertions(2);

        const originalPath = process.env["PATH"];
        const originalNvmDirectory = process.env["NVM_DIR"];

        try {
            process.env["PATH"] = tmpDirectory;
            delete process.env["NVM_DIR"];

            const manager = detectVersionManager(tmpDirectory);

            expect(manager.name).toBe("none");
            expect(manager.installed).toBe(false);
        } finally {
            if (originalPath === undefined) {
                delete process.env["PATH"];
            } else {
                process.env["PATH"] = originalPath;
            }

            if (originalNvmDirectory === undefined) {
                delete process.env["NVM_DIR"];
            } else {
                process.env["NVM_DIR"] = originalNvmDirectory;
            }
        }
    });

    it("should honour preferredManager override even when not detected", () => {
        expect.assertions(2);

        const originalPath = process.env["PATH"];

        try {
            process.env["PATH"] = tmpDirectory;

            const manager = detectVersionManager(tmpDirectory, { preferredManager: "mise" });

            expect(manager.name).toBe("mise");
            expect(manager.installed).toBe(false);
        } finally {
            if (originalPath === undefined) {
                delete process.env["PATH"];
            } else {
                process.env["PATH"] = originalPath;
            }
        }
    });
});

describe(buildInstallInvocation, () => {
    it("should build a proto invocation that reads .prototools", () => {
        expect.assertions(2);

        const invocation = buildInstallInvocation("proto");

        expect(invocation?.bin).toBe("proto");
        expect(invocation?.args).toEqual(["install"]);
    });

    it("should build a volta invocation per tool spec", () => {
        expect.assertions(2);

        const invocation = buildInstallInvocation("volta", { source: "vis.config.ts", tool: "node", version: "22.13.0" });

        expect(invocation?.bin).toBe("volta");
        expect(invocation?.args).toEqual(["install", "node@22.13.0"]);
    });

    it("should include a hint for nvm (shell function)", () => {
        expect.assertions(2);

        const invocation = buildInstallInvocation("nvm");

        expect(invocation?.bin).toBe("nvm");
        expect(invocation?.hint).toContain("shell function");
    });

    it("should return undefined for 'none'", () => {
        expect.assertions(1);

        expect(buildInstallInvocation("none")).toBeUndefined();
    });
});

describe(buildUseInvocation, () => {
    it("should build a proto pin invocation", () => {
        expect.assertions(3);

        const invocation = buildUseInvocation("proto", { source: "vis.config.ts", tool: "node", version: "22.13.0" });

        expect(invocation?.bin).toBe("proto");
        expect(invocation?.args).toEqual(["pin", "node", "22.13.0"]);
        expect(invocation?.configChange?.file).toBe(".prototools");
    });

    it("should build a mise use invocation", () => {
        expect.assertions(2);

        const invocation = buildUseInvocation("mise", { source: "vis.config.ts", tool: "pnpm", version: "10.32.1" });

        expect(invocation?.bin).toBe("mise");
        expect(invocation?.args).toEqual(["use", "--", "pnpm@10.32.1"]);
    });

    it("should build a volta pin invocation that writes to package.json", () => {
        expect.assertions(2);

        const invocation = buildUseInvocation("volta", { source: "vis.config.ts", tool: "node", version: "22.13.0" });

        expect(invocation?.args).toEqual(["pin", "node@22.13.0"]);
        expect(invocation?.configChange?.file).toBe("package.json");
    });

    it("should reject tools fnm cannot pin", () => {
        expect.assertions(1);

        expect(buildUseInvocation("fnm", { source: "vis.config.ts", tool: "pnpm", version: "10.32.1" })).toBeUndefined();
    });
});
