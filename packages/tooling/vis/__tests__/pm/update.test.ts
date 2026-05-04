import { describe, expect, it } from "vitest";

import type { UpdateCommandOptions } from "../../src/pm/package-manager";
import { resolveUpdateCommand } from "../../src/pm/package-manager";
// Also import catalog utilities for combined testing
import { extractPrefix, matchesFilters, parseCatalogsFromYaml } from "../../src/util/catalog";

const defaultOptions: UpdateCommandOptions = {
    dev: false,
    filters: [],
    global: false,
    interactive: false,
    latest: false,
    noOptional: false,
    noSave: false,
    packages: [],
    prod: false,
    recursive: false,
    workspaceRoot: false,
};

const options = (overrides: Partial<UpdateCommandOptions> = {}): UpdateCommandOptions => {
    return {
        ...defaultOptions,
        ...overrides,
    };
};

describe(resolveUpdateCommand, () => {
    describe("global", () => {
        it("should always use npm for global updates regardless of detected PM", () => {
            expect.assertions(2);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ global: true, packages: ["typescript"] }));

            expect(command.bin).toBe("npm");
            expect(command.args).toStrictEqual(["update", "--global", "typescript"]);
        });
    });

    describe("pnpm", () => {
        it("should resolve basic update", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ packages: ["react"] }));

            expect(command).toStrictEqual({ args: ["update", "react"], bin: "pnpm" });
        });

        it("should resolve update all", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options());

            expect(command).toStrictEqual({ args: ["update"], bin: "pnpm" });
        });

        it("should resolve with --latest", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: true, packages: ["react"] }));

            expect(command.args).toContain("--latest");
        });

        it("should resolve with filter before update", () => {
            expect.assertions(2);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ filters: ["app"] }));

            const filterIndex = command.args.indexOf("--filter");
            const updateIndex = command.args.indexOf("update");

            expect(filterIndex).toBeLessThan(updateIndex);
            expect(command.args[filterIndex + 1]).toBe("app");
        });

        it("should resolve with --recursive", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ recursive: true }));

            expect(command.args).toContain("--recursive");
        });

        it("should resolve with --interactive", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ interactive: true }));

            expect(command.args).toContain("--interactive");
        });

        it("should resolve with --dev", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ dev: true }));

            expect(command.args).toContain("--dev");
        });

        it("should resolve with --no-optional", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ noOptional: true }));

            expect(command.args).toContain("--no-optional");
        });

        it("should resolve with --no-save", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ noSave: true }));

            expect(command.args).toContain("--no-save");
        });

        it("should resolve with workspace-root as filter", () => {
            expect.assertions(2);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ workspaceRoot: true }));

            expect(command.args).toContain("--filter");
            expect(command.args[command.args.indexOf("--filter") + 1]).toBe(".");
        });

        it("should resolve complex combo", () => {
            expect.assertions(7);

            const { command } = resolveUpdateCommand(
                "pnpm",
                "9.0.0",
                options({
                    dev: true,
                    filters: ["app"],
                    latest: true,
                    packages: ["react", "react-dom"],
                    recursive: true,
                }),
            );

            expect(command.bin).toBe("pnpm");
            expect(command.args).toContain("--filter");
            expect(command.args).toContain("--latest");
            expect(command.args).toContain("--recursive");
            expect(command.args).toContain("--dev");
            expect(command.args).toContain("react");
            expect(command.args).toContain("react-dom");
        });

        it("should resolve multiple packages with latest", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: true, packages: ["react", "react-dom", "next"] }));

            expect(command.args).toStrictEqual(["update", "--latest", "react", "react-dom", "next"]);
        });
    });

    describe("yarn v1", () => {
        it("should use 'upgrade' command", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("yarn", "1.22.19", options({ packages: ["react"] }));

            expect(command).toStrictEqual({ args: ["upgrade", "react"], bin: "yarn" });
        });

        it("should resolve with --latest", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("yarn", "1.22.19", options({ latest: true, packages: ["react"] }));

            expect(command.args).toContain("--latest");
        });

        it("should resolve filter with workspace prefix", () => {
            expect.assertions(3);

            const { command } = resolveUpdateCommand("yarn", "1.22.19", options({ filters: ["app"], packages: ["react"] }));

            expect(command.args[0]).toBe("workspace");
            expect(command.args[1]).toBe("app");
            expect(command.args[2]).toBe("upgrade");
        });
    });

    describe("yarn v2+ (Berry)", () => {
        it("should use 'up' command", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ packages: ["react"] }));

            expect(command).toStrictEqual({ args: ["up", "react"], bin: "yarn" });
        });

        it("should resolve filter with workspaces foreach", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ filters: ["app"] }));

            expect(command.args).toStrictEqual(["workspaces", "foreach", "--all", "--include", "app", "up"]);
        });

        it("should resolve multiple filters", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ filters: ["app", "lib"] }));

            expect(command.args).toStrictEqual(["workspaces", "foreach", "--all", "--include", "app", "--include", "lib", "up"]);
        });

        it("should resolve recursive with workspaces foreach", () => {
            expect.assertions(3);

            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ recursive: true }));

            expect(command.args).toContain("workspaces");
            expect(command.args).toContain("foreach");
            expect(command.args).toContain("--all");
        });

        it("should resolve with --interactive", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ interactive: true }));

            expect(command.args).toContain("--interactive");
        });
    });

    describe("npm", () => {
        it("should resolve basic update", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ packages: ["react"] }));

            expect(command).toStrictEqual({ args: ["update", "react"], bin: "npm" });
        });

        it("should resolve update all", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options());

            expect(command).toStrictEqual({ args: ["update"], bin: "npm" });
        });

        it("should warn about --latest", () => {
            expect.assertions(2);

            const { warnings } = resolveUpdateCommand("npm", "10.0.0", options({ latest: true }));

            expect(warnings).toHaveLength(1);
            expect(warnings[0]).toContain("--latest");
        });

        it("should warn about --interactive", () => {
            expect.assertions(2);

            const { warnings } = resolveUpdateCommand("npm", "10.0.0", options({ interactive: true }));

            expect(warnings).toHaveLength(1);
            expect(warnings[0]).toContain("--interactive");
        });

        it("should resolve filter with --workspace", () => {
            expect.assertions(2);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ filters: ["app"] }));

            expect(command.args).toContain("--workspace");
            expect(command.args[command.args.indexOf("--workspace") + 1]).toBe("app");
        });

        it("should resolve recursive with --workspaces", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ recursive: true }));

            expect(command.args).toContain("--workspaces");
        });

        it("should resolve workspace-root with --include-workspace-root", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ workspaceRoot: true }));

            expect(command.args).toContain("--include-workspace-root");
        });

        it("should resolve with --dev", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ dev: true }));

            expect(command.args).toContain("--dev");
        });

        it("should resolve with --production for prod", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ prod: true }));

            expect(command.args).toContain("--production");
        });

        it("should resolve with --no-optional", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ noOptional: true }));

            expect(command.args).toContain("--no-optional");
        });

        it("should resolve with --no-save", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ noSave: true }));

            expect(command.args).toContain("--no-save");
        });
    });

    describe("bun", () => {
        it("should resolve basic update", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("bun", "1.0.0", options({ packages: ["react"] }));

            expect(command).toStrictEqual({ args: ["update", "react"], bin: "bun" });
        });

        it("should resolve with --latest", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("bun", "1.0.0", options({ latest: true }));

            expect(command.args).toContain("--latest");
        });

        it("should resolve filter with --filter", () => {
            expect.assertions(2);

            const { command } = resolveUpdateCommand("bun", "1.0.0", options({ filters: ["app"] }));

            expect(command.args).toContain("--filter");
            expect(command.args[command.args.indexOf("--filter") + 1]).toBe("app");
        });
    });

    describe("latest flag via target option", () => {
        it("should pass --latest for pnpm when latest is true", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: true }));

            expect(command.args).toContain("--latest");
        });

        it("should not pass --latest when latest is false", () => {
            expect.assertions(1);

            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: false }));

            expect(command.args).not.toContain("--latest");
        });
    });
});

describe("catalog integration", () => {
    it("should detect catalogs from YAML and filter packages", () => {
        expect.assertions(4);

        const yaml = `catalog:
  react: ^18.2.0
  '@types/node': ^20.0.0
  eslint: ^8.0.0
catalogs:
  dev:
    vitest: ^1.0.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        // Filter out @types packages
        const filtered: string[] = [];

        for (const [, deps] of catalogs) {
            for (const [name] of deps) {
                if (matchesFilters(name, [], ["@types/*"])) {
                    filtered.push(name);
                }
            }
        }

        expect(filtered).toContain("react");
        expect(filtered).toContain("eslint");
        expect(filtered).toContain("vitest");
        expect(filtered).not.toContain("@types/node");
    });

    it("should apply prefix from current range to new version", () => {
        expect.assertions(5);

        expect(extractPrefix("^18.2.0")).toBe("^");
        expect(extractPrefix("~5.3.0")).toBe("~");
        expect(extractPrefix(">=1.0.0")).toBe(">=");
        expect(extractPrefix("2.8.3")).toBe("");

        // Verify new range construction
        const currentRange = "^18.2.0";
        const targetVersion = "19.0.0";
        const newRange = `${extractPrefix(currentRange)}${targetVersion}`;

        expect(newRange).toBe("^19.0.0");
    });
});
