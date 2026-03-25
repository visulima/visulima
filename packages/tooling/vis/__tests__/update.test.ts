import { describe, expect, it } from "vitest";

// Also import catalog utilities for combined testing
import { extractPrefix, matchesFilters, parseCatalogsFromYaml } from "../src/catalog";
import type { UpdateCommandOptions } from "../src/package-manager";
import { resolveUpdateCommand } from "../src/package-manager";

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

describe("resolveUpdateCommand", () => {
    describe("global", () => {
        it("should always use npm for global updates regardless of detected PM", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ global: true, packages: ["typescript"] }));

            expect(command.bin).toBe("npm");
            expect(command.args).toEqual(["update", "--global", "typescript"]);
        });
    });

    describe("pnpm", () => {
        it("should resolve basic update", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ packages: ["react"] }));

            expect(command).toEqual({ args: ["update", "react"], bin: "pnpm" });
        });

        it("should resolve update all", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options());

            expect(command).toEqual({ args: ["update"], bin: "pnpm" });
        });

        it("should resolve with --latest", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: true, packages: ["react"] }));

            expect(command.args).toContain("--latest");
        });

        it("should resolve with filter before update", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ filters: ["app"] }));

            const filterIndex = command.args.indexOf("--filter");
            const updateIndex = command.args.indexOf("update");

            expect(filterIndex).toBeLessThan(updateIndex);
            expect(command.args[filterIndex + 1]).toBe("app");
        });

        it("should resolve with --recursive", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ recursive: true }));

            expect(command.args).toContain("--recursive");
        });

        it("should resolve with --interactive", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ interactive: true }));

            expect(command.args).toContain("--interactive");
        });

        it("should resolve with --dev", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ dev: true }));

            expect(command.args).toContain("--dev");
        });

        it("should resolve with --no-optional", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ noOptional: true }));

            expect(command.args).toContain("--no-optional");
        });

        it("should resolve with --no-save", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ noSave: true }));

            expect(command.args).toContain("--no-save");
        });

        it("should resolve with workspace-root as filter", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ workspaceRoot: true }));

            expect(command.args).toContain("--filter");
            expect(command.args[command.args.indexOf("--filter") + 1]).toBe(".");
        });

        it("should resolve complex combo", () => {
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
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: true, packages: ["react", "react-dom", "next"] }));

            expect(command.args).toEqual(["update", "--latest", "react", "react-dom", "next"]);
        });
    });

    describe("yarn v1", () => {
        it("should use 'upgrade' command", () => {
            const { command } = resolveUpdateCommand("yarn", "1.22.19", options({ packages: ["react"] }));

            expect(command).toEqual({ args: ["upgrade", "react"], bin: "yarn" });
        });

        it("should resolve with --latest", () => {
            const { command } = resolveUpdateCommand("yarn", "1.22.19", options({ latest: true, packages: ["react"] }));

            expect(command.args).toContain("--latest");
        });

        it("should resolve filter with workspace prefix", () => {
            const { command } = resolveUpdateCommand("yarn", "1.22.19", options({ filters: ["app"], packages: ["react"] }));

            expect(command.args[0]).toBe("workspace");
            expect(command.args[1]).toBe("app");
            expect(command.args[2]).toBe("upgrade");
        });
    });

    describe("yarn v2+ (Berry)", () => {
        it("should use 'up' command", () => {
            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ packages: ["react"] }));

            expect(command).toEqual({ args: ["up", "react"], bin: "yarn" });
        });

        it("should resolve filter with workspaces foreach", () => {
            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ filters: ["app"] }));

            expect(command.args).toEqual(["workspaces", "foreach", "--all", "--include", "app", "up"]);
        });

        it("should resolve multiple filters", () => {
            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ filters: ["app", "lib"] }));

            expect(command.args).toEqual(["workspaces", "foreach", "--all", "--include", "app", "--include", "lib", "up"]);
        });

        it("should resolve recursive with workspaces foreach", () => {
            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ recursive: true }));

            expect(command.args).toContain("workspaces");
            expect(command.args).toContain("foreach");
            expect(command.args).toContain("--all");
        });

        it("should resolve with --interactive", () => {
            const { command } = resolveUpdateCommand("yarn", "4.1.0", options({ interactive: true }));

            expect(command.args).toContain("--interactive");
        });
    });

    describe("npm", () => {
        it("should resolve basic update", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ packages: ["react"] }));

            expect(command).toEqual({ args: ["update", "react"], bin: "npm" });
        });

        it("should resolve update all", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options());

            expect(command).toEqual({ args: ["update"], bin: "npm" });
        });

        it("should warn about --latest", () => {
            const { warnings } = resolveUpdateCommand("npm", "10.0.0", options({ latest: true }));

            expect(warnings).toHaveLength(1);
            expect(warnings[0]).toMatch(/--latest/);
        });

        it("should warn about --interactive", () => {
            const { warnings } = resolveUpdateCommand("npm", "10.0.0", options({ interactive: true }));

            expect(warnings).toHaveLength(1);
            expect(warnings[0]).toMatch(/--interactive/);
        });

        it("should resolve filter with --workspace", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ filters: ["app"] }));

            expect(command.args).toContain("--workspace");
            expect(command.args[command.args.indexOf("--workspace") + 1]).toBe("app");
        });

        it("should resolve recursive with --workspaces", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ recursive: true }));

            expect(command.args).toContain("--workspaces");
        });

        it("should resolve workspace-root with --include-workspace-root", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ workspaceRoot: true }));

            expect(command.args).toContain("--include-workspace-root");
        });

        it("should resolve with --dev", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ dev: true }));

            expect(command.args).toContain("--dev");
        });

        it("should resolve with --production for prod", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ prod: true }));

            expect(command.args).toContain("--production");
        });

        it("should resolve with --no-optional", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ noOptional: true }));

            expect(command.args).toContain("--no-optional");
        });

        it("should resolve with --no-save", () => {
            const { command } = resolveUpdateCommand("npm", "10.0.0", options({ noSave: true }));

            expect(command.args).toContain("--no-save");
        });
    });

    describe("bun", () => {
        it("should resolve basic update", () => {
            const { command } = resolveUpdateCommand("bun", "1.0.0", options({ packages: ["react"] }));

            expect(command).toEqual({ args: ["update", "react"], bin: "bun" });
        });

        it("should resolve with --latest", () => {
            const { command } = resolveUpdateCommand("bun", "1.0.0", options({ latest: true }));

            expect(command.args).toContain("--latest");
        });

        it("should resolve filter with --filter", () => {
            const { command } = resolveUpdateCommand("bun", "1.0.0", options({ filters: ["app"] }));

            expect(command.args).toContain("--filter");
            expect(command.args[command.args.indexOf("--filter") + 1]).toBe("app");
        });
    });

    describe("latest flag via target option", () => {
        it("should pass --latest for pnpm when latest is true", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: true }));

            expect(command.args).toContain("--latest");
        });

        it("should not pass --latest when latest is false", () => {
            const { command } = resolveUpdateCommand("pnpm", "9.0.0", options({ latest: false }));

            expect(command.args).not.toContain("--latest");
        });
    });
});

describe("catalog integration", () => {
    it("should detect catalogs from YAML and filter packages", () => {
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
