import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import {
    buildBuildxCommand,
    ContainerActions,
    ociManifestUrl,
    parseImageRef,
    validateContainerConfig,
} from "../../../src/release/core/version-actions/container";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../../src/release/types";

/**
 * ContainerActions — Stage 3 SKELETON.
 *
 * Contract under test:
 *   1. parseImageRef + ociManifestUrl handle GHCR, Docker Hub (implicit
 *      + library/), localhost, and explicit-registry cases.
 *   2. buildBuildxCommand assembles the docker buildx invocation with
 *      multi-platform support, version/latest tags, build-args, labels.
 *   3. readPublishedVersion HEAD-checks the manifest endpoint.
 *   4. publish() throws CONFIG_INVALID without containerImage.
 *   5. publish() short-circuits when the manifest is already pushed.
 *   6. publish() runs docker buildx and (optionally) cosign sign.
 *   7. containerSkipLatest omits the :latest tag.
 *   8. cosign failure throws PUBLISH_FAILED.
 */

interface RunCall {
    args: ReadonlyArray<string>;
    command: string;
}

const buildRunner = (responses: { exitCode?: number; stderr?: string; stdout?: string }[]): { calls: RunCall[]; runner: CommandRunner } => {
    const calls: RunCall[] = [];
    let cursor = 0;

    const runner: CommandRunner = {
        run: async (command, args) => {
            calls.push({ args, command });

            const next = responses[cursor];

            cursor += 1;

            return next
                ? { exitCode: next.exitCode ?? 0, stderr: next.stderr ?? "", stdout: next.stdout ?? "" }
                : { exitCode: 0, stderr: "", stdout: "" };
        },
    };

    return { calls, runner };
};

const buildPkg = (overrides: Partial<WorkspacePackage> = {}): WorkspacePackage => {
    return {
        dir: "/cwd",
        manifest: { name: "@scope/app", version: "1.0.0" },
        manifestPath: "/cwd/package.json",
        name: "@scope/app",
        private: false,
        version: "1.0.0",
        ...overrides,
    };
};

const buildContext = (overrides: {
    dryRun?: boolean;
    newVersion?: string;
    perPackageConfig?: PerPackageReleaseConfig;
    runner?: CommandRunner;
} = {}): PublishContext => {
    return {
        catalogs: { default: {}, named: {} },
        dryRun: overrides.dryRun,
        perPackageConfig: overrides.perPackageConfig,
        pkg: buildPkg(),
        pm: {
            id: "npm",
            minVersion: "8.0.0",
            runner: overrides.runner ?? buildRunner([]).runner,
        } as never,
        release: {
            changeFiles: [],
            isCascadeBump: false,
            isDependencyBump: false,
            isGroupBump: false,
            name: "@scope/app",
            newVersion: overrides.newVersion ?? "1.1.0",
            oldVersion: "1.0.0",
            reasons: ["EXPLICIT"],
            sources: [],
            type: "minor",
        },
        versionedManifestByName: new Map(),
    };
};

describe("validateContainerConfig (N-4)", () => {
    // N-4: previously `readContainerConfig` widened the parent
    // PerPackageReleaseConfig with an unchecked `as ContainerPerPackageConfig`
    // cast. The strict validator replaces that for the publish path —
    // missing / non-string / empty `containerImage` now surfaces as a
    // CONFIG_INVALID with the operator-facing hint instead of slipping
    // into buildBuildxCommand where it would throw a confusing internal
    // error.
    it("returns a narrowed struct on a valid containerImage", () => {
        expect.hasAssertions();

        const result = validateContainerConfig(
            { containerImage: "ghcr.io/scope/foo", containerPlatforms: ["linux/amd64"] },
            "@scope/foo",
        );

        expect(result.containerImage).toBe("ghcr.io/scope/foo");
        expect(result.containerPlatforms).toStrictEqual(["linux/amd64"]);
    });

    it("throws CONFIG_INVALID when containerImage is missing entirely", () => {
        expect.hasAssertions();
        expect(() => validateContainerConfig({}, "@scope/foo")).toThrow(
            expect.objectContaining({
                code: "CONFIG_INVALID",
                packageName: "@scope/foo",
            }),
        );
    });

    it("throws CONFIG_INVALID when containerImage is an empty string", () => {
        expect.hasAssertions();
        expect(() => validateContainerConfig({ containerImage: "" }, "@scope/foo")).toThrow(
            expect.objectContaining({
                code: "CONFIG_INVALID",
                message: expect.stringContaining("@scope/foo"),
            }),
        );
    });

    it("throws CONFIG_INVALID when containerImage is the wrong type (defends against runtime coercion)", () => {
        // A user mis-configuring `containerImage: 42` via a templated
        // config tool previously slipped through the `as` cast; now it
        // surfaces clearly.
        expect.hasAssertions();
        expect(() =>
            validateContainerConfig(
                { containerImage: 42 as unknown as string },
                "@scope/foo",
            )).toThrow(
            expect.objectContaining({ code: "CONFIG_INVALID" }),
        );
    });

    it("treats undefined perPkg as missing-image (not a TypeError)", () => {
        expect.hasAssertions();
        expect(() => validateContainerConfig(undefined, "@scope/foo")).toThrow(
            expect.objectContaining({ code: "CONFIG_INVALID" }),
        );
    });
});

describe(parseImageRef, () => {
    it("splits GHCR refs (registry contains a dot)", () => {
        expect.hasAssertions();

        const result = parseImageRef("ghcr.io/scope/foo");

        expect(result).toStrictEqual({ registry: "ghcr.io", repository: "scope/foo" });
    });

    it("recognises localhost as a registry", () => {
        expect.hasAssertions();

        const result = parseImageRef("localhost:5000/foo");

        expect(result).toStrictEqual({ registry: "localhost:5000", repository: "foo" });
    });

    it("defaults the registry to docker.io and adds library/ for single-segment images", () => {
        expect.hasAssertions();

        const result = parseImageRef("nginx");

        expect(result).toStrictEqual({ registry: "docker.io", repository: "library/nginx" });
    });

    it("treats two-segment images without a hostname as docker.io", () => {
        expect.hasAssertions();

        const result = parseImageRef("myorg/myimage");

        expect(result).toStrictEqual({ registry: "docker.io", repository: "myorg/myimage" });
    });
});

describe(ociManifestUrl, () => {
    it("composes the v2 manifest URL for GHCR", () => {
        expect.hasAssertions();
        expect(ociManifestUrl("ghcr.io/scope/foo", "1.2.3")).toBe(
            "https://ghcr.io/v2/scope/foo/manifests/1.2.3",
        );
    });

    it("uses registry-1.docker.io for Docker Hub", () => {
        expect.hasAssertions();
        expect(ociManifestUrl("nginx", "stable")).toBe(
            "https://registry-1.docker.io/v2/library/nginx/manifests/stable",
        );
    });

    it("uRL-encodes tag values with special chars", () => {
        expect.hasAssertions();
        expect(ociManifestUrl("ghcr.io/s/f", "1.0.0+build")).toContain("%2B");
    });
});

describe(buildBuildxCommand, () => {
    const minPkg = {
        pkg: buildPkg(),
        release: { newVersion: "1.1.0" },
    };

    it("includes --platform, both tags, --push, and OCI labels by default", () => {
        expect.hasAssertions();

        const { command } = buildBuildxCommand(minPkg, { containerImage: "ghcr.io/scope/app" });

        expect(command[0]).toBe("docker");
        expect(command.slice(1, 3)).toStrictEqual(["buildx", "build"]);
        expect(command).toContain("--platform");
        expect(command[command.indexOf("--platform") + 1]).toBe("linux/amd64,linux/arm64");
        expect(command).toContain("ghcr.io/scope/app:1.1.0");
        expect(command).toContain("ghcr.io/scope/app:latest");
        expect(command).toContain("--push");
        expect(command).toContain("org.opencontainers.image.version=1.1.0");
    });

    it("omits :latest when containerSkipLatest is true", () => {
        expect.hasAssertions();

        const { command } = buildBuildxCommand(minPkg, {
            containerImage: "ghcr.io/scope/app",
            containerSkipLatest: true,
        });

        expect(command).toContain("ghcr.io/scope/app:1.1.0");
        expect(command).not.toContain("ghcr.io/scope/app:latest");
    });

    it("respects a custom containerPlatforms array", () => {
        expect.hasAssertions();

        const { command } = buildBuildxCommand(minPkg, {
            containerImage: "ghcr.io/scope/app",
            containerPlatforms: ["linux/amd64"],
        });

        expect(command[command.indexOf("--platform") + 1]).toBe("linux/amd64");
    });

    it("forwards containerBuildArgs as --build-arg KEY=VALUE pairs", () => {
        expect.hasAssertions();

        const { command } = buildBuildxCommand(minPkg, {
            containerBuildArgs: { BUILD_DATE: "2025-01-01", VERSION: "1.1.0" },
            containerImage: "ghcr.io/scope/app",
        });

        expect(command).toContain("--build-arg");
        // Order isn't guaranteed (Object.entries), so search for membership.
        expect(command).toContain("VERSION=1.1.0");
        expect(command).toContain("BUILD_DATE=2025-01-01");
    });

    it("uses buildContext as the final positional arg", () => {
        expect.hasAssertions();

        const { command } = buildBuildxCommand(minPkg, {
            buildContext: "./images/app",
            containerImage: "ghcr.io/scope/app",
        });

        expect(command.at(-1)).toBe("./images/app");
    });
});

describe("containerActions.readPublishedVersion", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("returns the current version when HEAD returns 200", async () => {
        expect.hasAssertions();

        globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 }) as never;

        const actions = new ContainerActions();
        const result = await actions.readPublishedVersion({
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            pkg: buildPkg({ version: "1.0.0" }),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBe("1.0.0");
        expect(globalThis.fetch).toHaveBeenCalledWith(
            "https://ghcr.io/v2/scope/app/manifests/1.0.0",
            expect.objectContaining({ method: "HEAD" }),
        );
    });

    it("returns undefined when HEAD is 404", async () => {
        expect.hasAssertions();

        globalThis.fetch = vi.fn().mockResolvedValue({ status: 404 }) as never;

        const actions = new ContainerActions();
        const result = await actions.readPublishedVersion({
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            pkg: buildPkg(),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when containerImage is missing", async () => {
        expect.hasAssertions();

        const fetchSpy = vi.fn();

        globalThis.fetch = fetchSpy as never;

        const actions = new ContainerActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("stamps a vis-release User-Agent and uses manual redirects (B-3 + M-4)", async () => {
        expect.hasAssertions();

        const fetchSpy = vi.fn().mockResolvedValue({
            headers: new Headers(),
            ok: true,
            status: 200,
        });

        globalThis.fetch = fetchSpy as never;

        const actions = new ContainerActions();

        await actions.readPublishedVersion({
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            pkg: buildPkg({ version: "1.0.0" }),
            pm: { runner: {} as CommandRunner } as never,
        });

        const init = fetchSpy.mock.calls[0]![1] as RequestInit | undefined;
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers!["User-Agent"]).toMatch(/^vis-release\//);
        expect(init?.redirect).toBe("manual");
    });
});

describe("containerActions.publish", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        // Default: HEAD says "not published yet" so the publish proceeds.
        globalThis.fetch = vi.fn().mockResolvedValue({ status: 404 }) as never;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("throws CONFIG_INVALID when containerImage is missing", async () => {
        expect.hasAssertions();

        const actions = new ContainerActions();

        await expect(actions.publish(buildContext())).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            hint: expect.stringContaining("containerImage"),
        });
    });

    it("emits a dry-run preview without invoking docker", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([]);
        const actions = new ContainerActions();

        const result = await actions.publish(buildContext({
            dryRun: true,
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[dry-run / container]");
        expect(result.output).toContain("docker buildx build");
        expect(calls).toHaveLength(0);
    });

    it("short-circuits with alreadyPublished when the manifest HEAD is 200", async () => {
        expect.hasAssertions();

        globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 }) as never;
        const { calls, runner } = buildRunner([]);
        const actions = new ContainerActions();

        const result = await actions.publish(buildContext({
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            runner,
        }));

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
        expect(calls).toHaveLength(0);
    });

    it("invokes docker buildx with the constructed command on a fresh publish", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([{ exitCode: 0 }]);
        const actions = new ContainerActions();

        const result = await actions.publish(buildContext({
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            runner,
        }));

        expect(result.published).toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0]!.command).toBe("docker");
        expect(calls[0]!.args).toContain("ghcr.io/scope/app:1.1.0");
        expect(calls[0]!.args).toContain("ghcr.io/scope/app:latest");
        expect(calls[0]!.args).toContain("--push");
    });

    it("runs cosign sign after a successful push when containerSigning is set", async () => {
        expect.hasAssertions();

        const { calls, runner } = buildRunner([
            { exitCode: 0 }, // buildx
            { exitCode: 0 }, // cosign
        ]);
        const actions = new ContainerActions();

        const result = await actions.publish(buildContext({
            perPackageConfig: {
                containerImage: "ghcr.io/scope/app",
                containerSigning: "cosign",
            } as never,
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("cosign");
        expect(calls).toHaveLength(2);
        expect(calls[1]!.command).toBe("cosign");
        expect(calls[1]!.args).toStrictEqual(["sign", "--yes", "ghcr.io/scope/app:1.1.0"]);
    });

    it("throws PUBLISH_FAILED when docker buildx exits non-zero with auth hints", async () => {
        expect.hasAssertions();

        const { runner } = buildRunner([{ exitCode: 1, stderr: "unauthorized: authentication required" }]);
        const actions = new ContainerActions();

        await expect(actions.publish(buildContext({
            perPackageConfig: { containerImage: "ghcr.io/scope/app" },
            runner,
        }))).rejects.toMatchObject({
            code: "PUBLISH_FAILED",
            hint: expect.stringContaining("docker login"),
        });
    });

    it("throws PUBLISH_FAILED when cosign sign fails", async () => {
        expect.hasAssertions();

        const { runner } = buildRunner([
            { exitCode: 0 }, // buildx
            { exitCode: 1, stderr: "no OIDC token available" }, // cosign
        ]);
        const actions = new ContainerActions();

        await expect(actions.publish(buildContext({
            perPackageConfig: {
                containerImage: "ghcr.io/scope/app",
                containerSigning: "cosign",
            } as never,
            runner,
        }))).rejects.toMatchObject({
            code: "PUBLISH_FAILED",
            message: expect.stringContaining("cosign"),
        });
    });

    it("stable id is `container`", () => {
        expect.hasAssertions();
        expect(new ContainerActions().id).toBe("container");
    });
});
