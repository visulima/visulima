import { join as pathJoin } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import readmeCommand from "../../src/commands/readme-command";
import type { Command as ICommand } from "../../src/types/command";
import type { CerebroFs } from "../../src/types/runtime";
import type { Toolbox } from "../../src/types/toolbox";

/**
 * Fake {@link CerebroFs} adapter used to assert README generation goes through
 * `toolbox.fs` (the injectable runtime) instead of touching `node:fs` directly.
 * `existing` controls whether `access` resolves (file exists) or rejects.
 */
const createFsMocks = () => {
    const state = { contents: new Map<string, string>(), existing: false };

    const access = vi.fn((path: string): Promise<void> => {
        if (!state.existing && !state.contents.has(path)) {
            return Promise.reject(new Error(`ENOENT: ${path}`));
        }

        return Promise.resolve();
    });
    const mkdir = vi.fn((): Promise<undefined> => Promise.resolve(undefined));
    const readFile = vi.fn((path: string): Promise<string> => Promise.resolve(state.contents.get(path) ?? ""));
    const writeFile = vi.fn((path: string, data: string): Promise<void> => {
        state.contents.set(path, data);

        return Promise.resolve();
    });
    const stat = vi.fn((): Promise<{ isDirectory: () => boolean; isFile: () => boolean }> => Promise.resolve({ isDirectory: () => false, isFile: () => true }));
    const rm = vi.fn((): Promise<undefined> => Promise.resolve(undefined));
    const readdir = vi.fn((): Promise<string[]> => Promise.resolve([]));

    const fs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as unknown as CerebroFs;

    return { access, fs, mkdir, readFile, state, writeFile };
};

let fsMocks: ReturnType<typeof createFsMocks>;

vi.mock(import("github-slugger"), () => {
    // Use closure to track occurrences since method may be extracted from instance
    const occurrences: Record<string, number> = {};

    const slugFunction = (value: string): string => {
        // Track occurrences for uniqueness (not used in tests but required by interface)
        const key = value.toLowerCase();

        occurrences[key] = (occurrences[key] ?? 0) + 1;

        const nonWordPattern = /[^\w\s-]+/g;
        const separatorPattern = /[\s_-]+/g;
        const trimPattern = /^-+|-$/g;

        return value.toLowerCase().trim().replaceAll(nonWordPattern, "").replaceAll(separatorPattern, "-").replaceAll(trimPattern, "");
    };

    const resetFunction = (): void => {
        const keys = Object.keys(occurrences);

        for (const key of keys) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete occurrences[key];
        }
    };

    return {
        default: class {
            public occurrences = occurrences;

            public slug = slugFunction;

            public reset = resetFunction;
        },
    };
});

describe("readme-command", () => {
    let mockToolbox: Toolbox;
    let mockCommands: Map<string, ICommand>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCommands = new Map<string, ICommand>([
            [
                "build",
                {
                    description: "Build the project",
                    execute: vi.fn(),
                    group: "Build",
                    name: "build",
                },
            ],
            [
                "test",
                {
                    description: "A test command",
                    execute: vi.fn(),
                    name: "test",
                    options: [
                        {
                            description: "Enable verbose output",
                            name: "verbose",
                            type: Boolean,
                        },
                    ],
                },
            ],
        ]);

        fsMocks = createFsMocks();

        mockToolbox = {
            fs: fsMocks.fs,
            logger: {
                debug: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            },
            options: {},
            process: {
                arch: "x64",
                argv: [],
                cwd: "/project",
                env: {},
                exit: vi.fn(),
                platform: "linux",
                stdin: "",
            },
            runtime: {
                getCliName: vi.fn(() => "test-cli"),
                getCommands: vi.fn(() => mockCommands),
                getPackageName: vi.fn(() => "test-package"),
                getPackageVersion: vi.fn(() => "1.0.0"),
            },
        } as unknown as Toolbox;
    });

    it("should have correct command metadata", () => {
        expect.assertions(9);

        expect(readmeCommand.name).toBe("readme");
        expect(readmeCommand.description).toBe("Generate README documentation for CLI commands");
        expect(readmeCommand.options).toHaveLength(8);
        expect(readmeCommand.options?.[0]?.name).toBe("aliases");
        expect(readmeCommand.options?.[1]?.name).toBe("dry-run");
        expect(readmeCommand.options?.[2]?.name).toBe("multi");
        expect(readmeCommand.options?.[3]?.name).toBe("nested-topics-depth");
        expect(readmeCommand.options?.[4]?.name).toBe("output-dir");
        expect(readmeCommand.options?.[5]?.name).toBe("readme-path");
    });

    it("should generate README with default options", async () => {
        expect.assertions(4);

        await readmeCommand.execute(mockToolbox);

        expect(mockToolbox.logger.debug).toHaveBeenCalledWith(expect.stringContaining("Processing"));
        expect(mockToolbox.logger.warn).toHaveBeenCalledWith(expect.stringContaining("README file not found"));
        expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("README generated successfully"));
        expect(fsMocks.writeFile).toHaveBeenCalledWith(expect.stringContaining("README.md"), expect.any(String), "utf8");
    });

    it("should read existing README and replace tags", async () => {
        expect.assertions(3);

        const existingReadme = `# Test Package

<!-- usage -->
<!-- usagestop -->

<!-- commands -->
<!-- commandsstop -->

<!-- toc -->
<!-- tocstop -->
`;

        fsMocks.state.existing = true;
        fsMocks.state.contents.set("/project/README.md", existingReadme);

        await readmeCommand.execute(mockToolbox);

        expect(fsMocks.readFile).toHaveBeenCalledWith(expect.stringContaining("README.md"), "utf8");
        expect(fsMocks.writeFile).toHaveBeenCalledWith(expect.stringContaining("README.md"), expect.any(String), "utf8");
        expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("README generated successfully"));
    });

    it("should use dry-run mode without writing files", async () => {
        expect.assertions(3);

        mockToolbox.options = { dryRun: true };

        await readmeCommand.execute(mockToolbox);

        expect(mockToolbox.logger.info).toHaveBeenCalledWith("Dry run mode - README not written");
        expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("Generated README content"));
        expect(fsMocks.writeFile).not.toHaveBeenCalled();
    });

    it("should use custom readme path", async () => {
        expect.assertions(3);

        mockToolbox.options = { readmePath: "CUSTOM.md" };

        await readmeCommand.execute(mockToolbox);

        const writeCall = fsMocks.writeFile.mock.calls[0];

        expect(writeCall).toBeDefined();

        expect(writeCall?.[0]).toBeDefined();

        const filePath = writeCall?.[0] ?? "";

        expect(filePath).toContain("CUSTOM.md");
    });

    it("should use custom output directory for multi-file mode", async () => {
        expect.assertions(2);

        mockToolbox.options = { multi: true, outputDir: "custom-docs" };

        await readmeCommand.execute(mockToolbox);

        expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining("custom-docs"), { recursive: true });
        expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("README generated successfully"));
    });

    it("should filter out hidden commands", async () => {
        expect.assertions(4);

        mockCommands.set("hidden", {
            description: "Hidden command",
            execute: vi.fn(),
            hidden: true,
            name: "hidden",
        });

        await readmeCommand.execute(mockToolbox);

        const writeCall = fsMocks.writeFile.mock.calls[0];

        expect(writeCall).toBeDefined();

        expect(writeCall?.[1]).toBeDefined();

        const content = writeCall?.[1] ?? "";

        expect(content).not.toContain("hidden");
        expect(content).toContain("test");
    });

    it("should include aliases when aliases option is enabled", async () => {
        expect.assertions(1);

        mockCommands.set("alias-test", {
            alias: "at",
            description: "Command with alias",
            execute: vi.fn(),
            name: "alias-test",
        });

        mockToolbox.options = { aliases: true };

        await readmeCommand.execute(mockToolbox);

        expect(mockToolbox.logger.debug).toHaveBeenCalledWith(expect.stringContaining("Processing"));
    });

    it("should handle commands with groups in multi-file mode", async () => {
        expect.assertions(2);

        mockToolbox.options = { multi: true };

        await readmeCommand.execute(mockToolbox);

        // Should create files for grouped commands
        expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining("docs"), { recursive: true });
        expect(fsMocks.writeFile.mock.calls.length).toBeGreaterThan(1);
    });

    it("should use custom version when provided", async () => {
        expect.assertions(3);

        mockToolbox.options = { version: "2.0.0" };

        await readmeCommand.execute(mockToolbox);

        const writeCall = fsMocks.writeFile.mock.calls[0];

        expect(writeCall).toBeDefined();

        expect(writeCall?.[1]).toBeDefined();

        const content = writeCall?.[1] ?? "";

        expect(content).toContain("2.0.0");
    });

    it("should handle nested commands", async () => {
        expect.assertions(3);

        mockCommands.set("staging", {
            commandPath: ["deploy"],
            description: "Nested command",
            execute: vi.fn(),
            name: "staging",
        });

        await readmeCommand.execute(mockToolbox);

        const writeCall = fsMocks.writeFile.mock.calls[0];

        expect(writeCall).toBeDefined();

        expect(writeCall?.[1]).toBeDefined();

        const content = writeCall?.[1] ?? "";

        expect(content).toContain("deploy staging");
    });

    it("should create directory structure for multi-file output", async () => {
        expect.assertions(1);

        mockToolbox.options = { multi: true, outputDir: "docs/commands" };

        await readmeCommand.execute(mockToolbox);

        expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining(pathJoin("docs", "commands")), { recursive: true });
    });
});
