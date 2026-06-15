/**
 * `container` versionActions — OCI container registries
 * (GHCR / Docker Hub / ECR / GCR / GAR / custom).
 *
 * **Stage 3 SKELETON.** Containers are structurally different from
 * version-published artifacts: a registry tag is mutable, the "version"
 * concept is an OCI image label / immutable digest, and `latest` is
 * conventional rather than enforced.
 *
 * What's implemented today:
 *
 *   - **Discovery via `containerImage`.** Containers don't have a
 *     manifest equivalent to package.json; the operator declares
 *     `containerImage: "ghcr.io/scope/foo"` in per-pkg config. Without
 *     it, the action throws `CONFIG_INVALID` at publish time.
 *   - **Already-published detection** — `HEAD https://&lt;registry>/v2/
 *     &lt;image>/manifests/&lt;tag>` with the new version as the tag (per
 *     the OCI Distribution Spec). 200 → already pushed. 404 → publish.
 *     Other → undefined (fail-open).
 *   - **Publish via `docker buildx`.** Construct + run:
 *
 *       docker buildx build \
 *         --platform &lt;platforms> \
 *         -t &lt;image>:&lt;version> \
 *         -t &lt;image>:latest \
 *         --push \
 *         &lt;buildContext>
 *
 *     Honours `containerPlatforms` (default
 *     `["linux/amd64", "linux/arm64"]`).
 *   - **Cosign signing.** When `containerSigning: "cosign"`, runs
 *     `cosign sign --yes &lt;image>:&lt;version>` after the push. Cosign
 *     keyless flow (via OIDC) is the recommended setup; that's a
 *     cosign config concern, not a vis concern.
 *
 * What's **NOT** done (intentionally):
 *
 *   - Bearer-token auth flow for private registries' manifest HEAD.
 *     The HEAD goes out unauthenticated; private registries return
 *     401 and we treat that as "unknown — publish anyway", which is
 *     the right call (docker buildx will fail loudly if the
 *     credentials are missing). Operators who need authenticated
 *     HEAD checks can drop to `versionActions: "shell"` with a
 *     `checkPublished: "docker manifest inspect &lt;image>:{{version}}"`.
 *   - Registry-specific auth setup (`aws ecr get-login-password`, gcloud
 *     `gcloud auth configure-docker`, etc.) — we expect the operator
 *     to have run `docker login` before invoking vis. The docs file
 *     spells this out.
 *   - SBOM attestation / provenance attestation flags on the buildx
 *     command — supported by docker buildx 0.11+ via `--attest`, but
 *     deferred until the operator can configure them per-package.
 *   - Multi-tag schemes beyond `&lt;version>` + `latest` (e.g. semver
 *     coercion to `&lt;major>` / `&lt;major>.&lt;minor>` shorthands). Possible
 *     follow-up; for now operators wanting more tags can drop to the
 *     shell path.
 *
 * Tag mutability vs git tags: the orchestrator still creates the
 * configured git tag (`&lt;name>@&lt;version>` by default) — git tags are
 * immutable. The container itself gets BOTH a `:&lt;version>` tag (the
 * intended-immutable version pointer) AND a `:latest` tag (mutable,
 * conventional). Repushing the same `&lt;version>` would silently
 * overwrite — the already-published HEAD check is the guardrail.
 */

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

const DEFAULT_CONTAINER_PLATFORMS = ["linux/amd64", "linux/arm64"] as const;

interface ParsedImageRef {
    /** Registry hostname (and optional port). */
    registry: string;
    /** Image repository path (everything after the registry hostname). */
    repository: string;
}

/**
 * Split an OCI image reference into `(registry, repository)`. The OCI
 * spec is annoyingly historical here — `ghcr.io/scope/foo`,
 * `docker.io/library/foo`, `localhost:5000/foo`, and `foo` are all
 * legal in different contexts. Rules:
 *
 *   - First path segment is the registry IFF it contains a `.`, a `:`,
 *     OR is the literal `localhost`.
 *   - Otherwise the registry is implicitly Docker Hub (`docker.io`)
 *     and the whole thing is the repository.
 *
 * Exported so tests + the manifest URL builder can exercise it.
 */
export const parseImageRef = (image: string): ParsedImageRef => {
    const slashIndex = image.indexOf("/");

    if (slashIndex === -1) {
        return { registry: "docker.io", repository: `library/${image}` };
    }

    const first = image.slice(0, slashIndex);
    const rest = image.slice(slashIndex + 1);

    if (first === "localhost" || first.includes(".") || first.includes(":")) {
        return { registry: first, repository: rest };
    }

    // Implicit Docker Hub. Single-segment images live under library/.
    if (!rest.includes("/")) {
        return { registry: "docker.io", repository: `${first}/${rest}` };
    }

    return { registry: "docker.io", repository: image };
};

/**
 * Compose the OCI Distribution Spec manifest URL for a (image, tag).
 * Used both for the HEAD check and (later) for `docker manifest`
 * fall-back flows.
 *
 *   `ghcr.io/scope/foo @ 1.2.3`
 *   →  `https://ghcr.io/v2/scope/foo/manifests/1.2.3`
 */
export const ociManifestUrl = (image: string, tag: string): string => {
    const { registry, repository } = parseImageRef(image);
    // Docker Hub's "real" registry endpoint isn't the friendly `docker.io`
    // hostname — that's the auth server. The manifest registry is
    // `registry-1.docker.io`. Special-case it; everyone else's
    // `<registry>/v2/<repo>/manifests/<tag>` is well-formed.
    const host = registry === "docker.io" ? "registry-1.docker.io" : registry;

    return `https://${host}/v2/${repository}/manifests/${encodeURIComponent(tag)}`;
};

/** Per-pkg fields consumed by ContainerActions (subset of {@link PerPackageReleaseConfig}). */
interface ContainerPerPackageConfig {
    /**
     * Build context passed to `docker buildx build`. Defaults to the
     * package directory. Honours absolute paths and dir-relative paths.
     */
    buildContext?: string;

    /**
     * Extra `--build-arg KEY=VALUE` pairs forwarded to buildx. Convenient
     * for stamping the version into the image at build time.
     */
    containerBuildArgs?: Record<string, string>;
    /** Fully-qualified image reference, e.g. `"ghcr.io/scope/foo"`. */
    containerImage?: string;

    /**
     * Target platforms for the buildx multi-arch build. Defaults to
     * `["linux/amd64", "linux/arm64"]`. To build a single-arch image,
     * pass a single-entry array.
     */
    containerPlatforms?: ReadonlyArray<string>;

    /**
     * Signing scheme to apply after a successful push. `"cosign"` runs
     * `cosign sign --yes &lt;image>:&lt;version>`. Other values are reserved
     * for future implementations (notarize, sigstore-bundle, etc.).
     */
    containerSigning?: "cosign";

    /**
     * Skip the conventional `:latest` tag on push — useful for
     * pre-release / channel-specific images that shouldn't move
     * the floating-`latest` pointer.
     */
    containerSkipLatest?: boolean;
}

/**
 * Permissive read of the container-relevant subset of
 * PerPackageReleaseConfig. Used by `readPublishedVersion` where a
 * missing `containerImage` is tolerated (the orchestrator treats
 * unknown-published-version as "publish anyway"; the real validation
 * happens at publish time).
 *
 * N-4: this is the ONLY place that copies fields off the parent
 * config without enforcing `containerImage` — every code path that
 * actually publishes (i.e. would attempt a docker push) routes
 * through {@link validateContainerConfig} instead, which throws
 * CONFIG_INVALID on missing/empty `containerImage`. The old shape
 * `(perPkg ?? {}) as ContainerPerPackageConfig` was an unchecked
 * widening that risked propagating a malformed config silently into
 * the publish path.
 */
const readContainerConfig = (perPkg: PerPackageReleaseConfig | undefined): ContainerPerPackageConfig => {
    const source = perPkg ?? {};

    return {
        buildContext: source.buildContext,
        containerBuildArgs: source.containerBuildArgs,
        containerImage: source.containerImage,
        containerPlatforms: source.containerPlatforms,
        containerSigning: source.containerSigning,
        containerSkipLatest: source.containerSkipLatest,
    };
};

/**
 * Strict validator used by the publish path. Replaces the previous
 * unchecked `as ContainerPerPackageConfig` cast (N-4) with an explicit
 * runtime check: a non-string / empty `containerImage` throws
 * `CONFIG_INVALID` instead of slipping into buildBuildxCommand where
 * it would surface as a confusing internal error.
 *
 * Returns a struct with the validated `containerImage` narrowed to
 * `string` so callers don't need their own null checks.
 */
export const validateContainerConfig = (
    perPkg: PerPackageReleaseConfig | undefined,
    packageName: string,
): ContainerPerPackageConfig & { containerImage: string } => {
    const config = readContainerConfig(perPkg);

    if (typeof config.containerImage !== "string" || config.containerImage.length === 0) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: [
                "Container packages must declare `containerImage` in their per-pkg release config:",
                "",
                "    release.packages[\"<pkg>\"] = container({",
                "        image: \"ghcr.io/scope/foo\",",
                "        platforms: [\"linux/amd64\", \"linux/arm64\"],",
                "        signing: \"cosign\", // optional",
                "    })",
                "",
                "Or set `versionActions: \"container\"` + `containerImage` directly.",
            ].join("\n"),
            message: `containerImage is required for versionActions: "container" on ${packageName}`,
            packageName,
        });
    }

    return {
        buildContext: config.buildContext,
        containerBuildArgs: config.containerBuildArgs,
        containerImage: config.containerImage,
        containerPlatforms: config.containerPlatforms,
        containerSigning: config.containerSigning,
        containerSkipLatest: config.containerSkipLatest,
    };
};

export class ContainerActions extends VersionActions {
    public readonly id = "container" as const;

    /**
     * Probe the registry for the new version's tag via an unauthenticated
     * `HEAD /v2/&lt;repo>/manifests/&lt;tag>` request.
     *
     *   200 → the version is already pushed → return the version literal
     *   404 → the version is fresh → return undefined
     *   anything else (401, 5xx, network error) → undefined (fail-open;
     *   let the docker push surface the auth/network issue).
     */
    public async readPublishedVersion(context: {
        perPackageConfig?: PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
        workspaceConfig?: import("../../types").VisReleaseConfig;
    }): Promise<string | undefined> {
        const containerConfig = readContainerConfig(context.perPackageConfig);

        if (!containerConfig.containerImage) {
            // Without an image ref we can't probe. Returning undefined
            // is correct — the publish path will throw `CONFIG_INVALID`
            // with the clear hint when actually invoked.
            return undefined;
        }

        // The publish path uses the new version as the tag. We don't
        // have it here — `readPublishedVersion` runs against the
        // package's CURRENT version. That's intentional symmetry with
        // the npm flow: "what's already up there now?".
        const tag = context.pkg.version;
        const url = ociManifestUrl(containerConfig.containerImage, tag);

        try {
            // M-4 SSRF guard: `containerImage` is operator-configurable
            // and could be coerced into pointing at an internal
            // registry that redirects to an even more sensitive host.
            // `safeFetchVersionMetadata` follows up to 2 same-host
            // redirects manually and treats anything cross-host as
            // unknown.
            const response = await safeFetchVersionMetadata(url, {
                headers: {
                    // OCI Distribution Spec — every manifest endpoint
                    // must accept the OCI manifest mediatype. Including
                    // the Docker v2 fallback keeps the request friendly
                    // to older registries.
                    Accept: [
                        "application/vnd.oci.image.manifest.v1+json",
                        "application/vnd.oci.image.index.v1+json",
                        "application/vnd.docker.distribution.manifest.v2+json",
                        "application/vnd.docker.distribution.manifest.list.v2+json",
                    ].join(","),
                },
                httpProxy: context.workspaceConfig?.httpProxy,
                method: "HEAD",
            });

            if (response.status === 200) {
                return tag;
            }

            return undefined;
        } catch {
            return undefined;
        }
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        // N-4: validator throws CONFIG_INVALID with the operator-friendly
        // hint when `containerImage` is missing/empty. The returned struct
        // narrows `containerImage` to `string`, removing the need for
        // downstream null-checks (and matching the eventual buildBuildxCommand
        // signature without an unchecked cast).
        const containerConfig = validateContainerConfig(context.perPackageConfig, context.pkg.name);

        if (context.dryRun) {
            const { command } = buildBuildxCommand(context, containerConfig);

            return {
                output: `[dry-run / container] would run: ${command.join(" ")}`,
                published: true,
            };
        }

        // Already-published guard: a HEAD against the NEW version's tag
        // (readPublishedVersion uses the current version; here we use
        // the just-bumped one). Without this guard, a re-run after a
        // partial failure would silently overwrite an existing image —
        // the registry has no built-in idempotency for tag pushes.
        //
        // M-4: same SSRF guarantee as readPublishedVersion — manual
        // redirects, same-host-only.
        try {
            const headUrl = ociManifestUrl(containerConfig.containerImage, context.release.newVersion);
            const response = await safeFetchVersionMetadata(headUrl, {
                httpProxy: context.workspaceConfig?.httpProxy,
                method: "HEAD",
            });

            if (response.status === 200) {
                return {
                    alreadyPublished: true,
                    output: `[container] ${containerConfig.containerImage}:${context.release.newVersion} already published`,
                    published: false,
                };
            }
        } catch {
            // HEAD failed — treat as unknown; proceed to publish.
        }

        const { command } = buildBuildxCommand(context, containerConfig);

        const buildResult = await context.pm.runner.run(command[0]!, command.slice(1), {
            cwd: context.pkg.dir,
            silent: false,
        });

        if (buildResult.exitCode !== 0) {
            throw new VisReleaseError({
                code: "PUBLISH_FAILED",
                hint: [
                    "docker buildx build failed. Common causes:",
                    "  • Not authenticated to the registry — run `docker login <registry>` first.",
                    "    For ECR: `aws ecr get-login-password --region <r> | docker login --username AWS --password-stdin <account>.dkr.ecr.<r>.amazonaws.com`",
                    "    For GCR/GAR: `gcloud auth configure-docker <region>-docker.pkg.dev`",
                    "    For GHCR: `echo $GITHUB_TOKEN | docker login ghcr.io -u <user> --password-stdin`",
                    "  • Buildx not installed / configured — `docker buildx create --use` (one-time setup).",
                    "  • Multi-arch build needs QEMU registered — `docker run --privileged --rm tonistiigi/binfmt --install all`.",
                ].join("\n"),
                message: `docker buildx failed for ${context.pkg.name}@${context.release.newVersion}: exit ${buildResult.exitCode}. stderr: ${buildResult.stderr.trim().slice(0, 500)}`,
                packageName: context.pkg.name,
            });
        }

        // Optional cosign signing pass. We sign the just-pushed
        // `<image>:<version>` (NOT `:latest`, which is a mutable
        // pointer — signatures should target the immutable version).
        if (containerConfig.containerSigning === "cosign") {
            const target = `${containerConfig.containerImage}:${context.release.newVersion}`;
            const signResult = await context.pm.runner.run(
                "cosign",
                ["sign", "--yes", target],
                { cwd: context.pkg.dir, silent: false },
            );

            if (signResult.exitCode !== 0) {
                throw new VisReleaseError({
                    code: "PUBLISH_FAILED",
                    hint: "cosign signing failed. For keyless cosign, ensure COSIGN_EXPERIMENTAL=1 (cosign <2.0) and the CI runner has the OIDC token (`id-token: write` permission on GH Actions).",
                    message: `cosign sign failed for ${target}: exit ${signResult.exitCode}. stderr: ${signResult.stderr.trim().slice(0, 500)}`,
                    packageName: context.pkg.name,
                });
            }
        }

        return {
            output: `[container] published ${containerConfig.containerImage}:${context.release.newVersion}${containerConfig.containerSkipLatest ? "" : " + :latest"}${containerConfig.containerSigning === "cosign" ? " (signed via cosign)" : ""}`,
            published: true,
        };
    }
}

interface BuildBuildxResult {
    command: string[];
}

/**
 * Construct the `docker buildx build` invocation that publishes a
 * container. Pure function for testability — the actions class invokes
 * it and runs the result; tests can assert against the produced
 * argv without needing a real docker.
 */
export const buildBuildxCommand = (
    context: { pkg: WorkspacePackage; release: { newVersion: string } },
    config: ContainerPerPackageConfig,
): BuildBuildxResult => {
    if (!config.containerImage) {
        throw new Error("buildBuildxCommand requires config.containerImage");
    }

    const platforms = (config.containerPlatforms ?? DEFAULT_CONTAINER_PLATFORMS).join(",");
    const tagPrimary = `${config.containerImage}:${context.release.newVersion}`;
    const tagLatest = `${config.containerImage}:latest`;
    const buildContext = config.buildContext ?? ".";

    const command: string[] = [
        "docker",
        "buildx",
        "build",
        "--platform",
        platforms,
        "-t",
        tagPrimary,
    ];

    if (!config.containerSkipLatest) {
        command.push("-t", tagLatest);
    }

    for (const [key, value] of Object.entries(config.containerBuildArgs ?? {})) {
        command.push("--build-arg", `${key}=${value}`);
    }

    command.push("--label", `org.opencontainers.image.version=${context.release.newVersion}`);
    command.push("--label", `org.opencontainers.image.title=${context.pkg.name}`);

    command.push("--push", buildContext);

    return { command };
};

// Re-export the manifest type so downstream callers know what fields
// they get on `context.pkg`.

export { type PackageManifest } from "../../types";
