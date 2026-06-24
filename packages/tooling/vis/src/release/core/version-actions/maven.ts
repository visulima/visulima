/**
 * `maven` versionActions — Maven Central / Sonatype Central Portal.
 *
 * **Stage 3 SKELETON.** What's implemented today:
 *
 *   - **Version read** — parses the first `&lt;version>` directly under
 *     `&lt;project>` in `pom.xml` via a deliberately surgical regex
 *     (`fast-xml-parser` is not in the vis dep tree, and pulling it in
 *     just for this read isn't justified yet).
 *   - **Multi-module sniff** — warns to stderr when `&lt;modules>` is
 *     present so the operator knows vis treats a reactor build as a
 *     single artifact; for proper multi-module reactor handling, drop
 *     to `versionActions: "shell"` and call `mvn deploy` directly.
 *   - **Already-published detection** — `GET https://repo1.maven.org/maven2/
 *     &lt;groupId-with-slashes>/&lt;artifactId>/maven-metadata.xml`. Parses the
 *     `&lt;latest>` element (or last `&lt;version>` in `&lt;versions>` as fallback).
 *     404 → undefined (the package is new). Custom repositories
 *     can opt out by configuring `checkPublished: ""` in their per-pkg
 *     config; see {@link MavenVersionActions.readPublishedVersion}.
 *
 * What's **NOT** implemented yet (deferred to a follow-up stage):
 *
 *   - **Native publish via the Central Portal upload API.** The
 *     post-2024 Sonatype Central Portal flow is genuinely non-trivial:
 *       1. GPG-sign every artifact (.jar, .pom, sources.jar, javadoc.jar)
 *       2. Bundle the signed artifacts into a deployment .zip
 *       3. `POST https://central.sonatype.com/api/v1/publisher/upload`
 *       4. Poll deployment status (`/api/v1/publisher/status/&lt;id>`)
 *          until VALIDATED — minutes-to-hours latency
 *       5. Trigger publish (auto-publish in `AUTOMATIC` mode, manual in
 *          `USER_MANAGED` mode)
 *
 *     For v1 this method throws `CONFIG_INVALID` with a copy-paste hint
 *     pointing at the shell workaround:
 *
 *         versionActions: "shell",
 *         publishCommand: "mvn -B -ntp deploy",
 *
 *     plus a configured Central Portal publishing plugin in the operator's
 *     pom.xml (`central-publishing-maven-plugin` or
 *     `nexus-staging-maven-plugin`). See `docs/guides/release-maven.mdx`.
 *
 *   - **OIDC trusted publishing.** Maven Central does NOT support OIDC
 *     trusted publishing (as of late 2024). Authentication still
 *     requires a Central Portal user token in `~/.m2/settings.xml` (or
 *     env-substituted in CI via `MAVEN_USERNAME` / `MAVEN_PASSWORD`).
 *     PyPI-style "publish without secrets" is on the Sonatype roadmap
 *     but no committed ship date.
 *
 *   - **Pre-publish guards** (artifact signature verification, GPG
 *     keyring health, deploy-bundle validation). Skipped for v1 — when
 *     native publish lands, the existing `publish-guards.ts` framework
 *     gains a Maven-specific guard pack.
 *
 * Wire it up via per-package config or via the `pomXml({…})` preset
 * (which now defaults `versionActions: "maven"`):
 *
 *     release: {
 *         packages: {
 *             "@scope/jvm-sdk": pomXml({ pomDir: "jvm/sdk" }),
 *         },
 *     }
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { VisReleaseError } from "../../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import { safeFetchVersionMetadata } from "./fetch";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

interface PomCoordinates {
    artifactId?: string;
    groupId?: string;
    /** True if the pom declares any `&lt;modules>` (reactor / multi-module build). */
    hasModules: boolean;
    /** The project's declared version (first `&lt;version>` under `&lt;project>`). */
    version?: string;
}

// B-4: regex literals lifted to module scope so they compile exactly
// once per process instead of on every parsePomCoordinates call. These
// matchers are stateless (no `g` flag → no `lastIndex` mutation between
// calls), so sharing them across invocations is safe. Strip-comments,
// project-root, and version/groupId/artifactId pickers were previously
// constructed inline; cheap individually but visible on profiles when
// iterating a large workspace.
const POM_STRIP_COMMENTS = /<!--[\s\S]*?-->/g;
const POM_PROJECT_OPEN = /<project\b[^>]*>([\s\S]*)/i;
const POM_VERSION = /<version>\s*([^<]+?)\s*<\/version>/i;
const POM_GROUP_ID = /<groupId>\s*([^<]+?)\s*<\/groupId>/i;
const POM_ARTIFACT_ID = /<artifactId>\s*([^<]+?)\s*<\/artifactId>/i;
const POM_HAS_MODULES = /<modules\b[^>]*>[\s\S]*?<module\b/i;

/**
 * Parse a pom.xml's project coordinates without pulling in a full XML
 * parser. The regexes are intentionally narrow: we want the FIRST
 * `&lt;version>` (project version, not a parent or a dependency version),
 * and `&lt;groupId>` / `&lt;artifactId>` declared at the project root.
 *
 * For pathological poms (CDATA blocks around the version, multiple
 * `&lt;project>` elements, hand-rolled XML namespacing) the parse is
 * best-effort. The version-read path tolerates `undefined` gracefully
 * — the orchestrator already handles unknown-published-version as
 * "publish anyway".
 *
 * The hairier multi-module / reactor case is intentionally deferred
 * to shell publish (mvn handles its own coordination); we just flag
 * its presence so the operator sees the warning before they discover
 * the limitation mid-release.
 */
export const parsePomCoordinates = (xml: string): PomCoordinates => {
    // Strip XML comments — they can carry stray <version> tokens that
    // would otherwise poison the first-match search. Regex hoisted to
    // module scope (B-4).
    const stripped = xml.replaceAll(POM_STRIP_COMMENTS, "");

    const projectMatch = POM_PROJECT_OPEN.exec(stripped);
    const body = projectMatch?.[1] ?? stripped;

    // Find the <version> that belongs to the project itself — NOT one
    // nested inside <parent>, <dependencies>, <dependencyManagement>,
    // <build>, etc. Slicing "everything before the first nested tag" is
    // wrong when a nested block (commonly <parent>) precedes the
    // project's own <version>: it would discard the real version and
    // the whole-body fallback then grabs the parent/dependency version.
    // Instead, strip the nested container blocks outright so the first
    // remaining <version> is the project-root one.
    const beforeNested = body
        .replaceAll(/<parent\b[\s\S]*?<\/parent>/gi, "")
        .replaceAll(/<dependencyManagement\b[\s\S]*?<\/dependencyManagement>/gi, "")
        .replaceAll(/<dependencies\b[\s\S]*?<\/dependencies>/gi, "")
        .replaceAll(/<build\b[\s\S]*?<\/build>/gi, "")
        .replaceAll(/<profiles\b[\s\S]*?<\/profiles>/gi, "")
        .replaceAll(/<pluginRepositories\b[\s\S]*?<\/pluginRepositories>/gi, "")
        .replaceAll(/<repositories\b[\s\S]*?<\/repositories>/gi, "");

    // B-4: the version/groupId/artifactId pickers are stateless (no `g`
    // flag → no `lastIndex` to reset), so reusing the module-level
    // RegExp instance across both the project-root scan and the
    // whole-body fallback is safe. Saves six allocations per call.
    const versionMatch = POM_VERSION.exec(beforeNested) ?? POM_VERSION.exec(body);
    const groupIdMatch = POM_GROUP_ID.exec(beforeNested) ?? POM_GROUP_ID.exec(body);
    const artifactIdMatch = POM_ARTIFACT_ID.exec(beforeNested) ?? POM_ARTIFACT_ID.exec(body);
    const hasModules = POM_HAS_MODULES.test(body);

    return {
        artifactId: artifactIdMatch?.[1],
        groupId: groupIdMatch?.[1],
        hasModules,
        version: versionMatch?.[1],
    };
};

/**
 * Parse `maven-metadata.xml` and pull the latest published version.
 * Prefer `&lt;versioning>&lt;latest>` (Maven's own canonical pointer); fall
 * back to the last `&lt;version>` in `&lt;versions>` (some artifact servers
 * — Artifactory in particular — omit `&lt;latest>`).
 */
export const parseMavenMetadataLatest = (xml: string): string | undefined => {
    const latestMatch = /<latest>\s*([^<]+?)\s*<\/latest>/i.exec(xml);

    if (latestMatch?.[1]) {
        return latestMatch[1];
    }

    const versionsBlock = /<versions>([\s\S]*?)<\/versions>/i.exec(xml);

    if (!versionsBlock) {
        return undefined;
    }

    const versions = [...versionsBlock[1]!.matchAll(/<version>\s*([^<]+?)\s*<\/version>/gi)].map((m) => m[1]!);

    return versions.at(-1);
};

/**
 * Compose the Maven Central metadata URL for a given (groupId, artifactId).
 * Maven Central serves coordinates as path segments with `.` → `/`.
 *
 *   `io.visulima:vis-jvm`  →  `https://repo1.maven.org/maven2/io/visulima/vis-jvm/maven-metadata.xml`
 */
export const mavenCentralMetadataUrl = (groupId: string, artifactId: string): string => {
    const groupPath = groupId
        .split(".")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    const safeArtifact = encodeURIComponent(artifactId);

    return `https://repo1.maven.org/maven2/${groupPath}/${safeArtifact}/maven-metadata.xml`;
};

const MAVEN_PUBLISH_HINT = [
    "Native Maven publishing isn't implemented yet. Drop to the generic shell path:",
    "",
    "  release.packages[\"<your-pkg>\"] = {",
    "      ...pomXml({ pomDir: \"jvm/sdk\" }),",
    "      versionActions: \"shell\",",
    "      publishCommand: \"mvn -B -ntp deploy\",",
    "      checkPublished: \"\",",
    "  }",
    "",
    "Configure either `central-publishing-maven-plugin` (recommended for",
    "Sonatype Central Portal) or `nexus-staging-maven-plugin` (legacy OSSRH)",
    "in your pom.xml, plus credentials in ~/.m2/settings.xml.",
    "",
    "Maven Central does not (yet) support OIDC trusted publishing —",
    "static credentials are required. See docs/guides/release-maven.mdx",
    "for the full setup walkthrough.",
].join("\n");

/** Per-package fields consumed by Maven actions (subset of {@link PerPackageReleaseConfig}). */
interface MavenPerPackageConfig {
    /**
     * Override the Maven Central metadata URL. Set this when publishing
     * to a custom repository (Artifactory, Nexus, GitHub Packages). The
     * URL should point at `&lt;base>/&lt;groupId>/&lt;artifactId>/maven-metadata.xml`.
     * Set to `""` (empty string) to disable the already-published check
     * entirely — useful when the repository requires auth and you'd
     * rather let the publish itself surface "already exists" errors.
     */
    mavenMetadataUrl?: string;
    /** Override `pom.xml` path relative to the package dir. Default: `pom.xml`. */
    pomPath?: string;
}

export class MavenVersionActions extends VersionActions {
    public readonly id = "maven" as const;

    /**
     * N-5: surface the operator-friendly multi-module warning exactly
     * once per (package, actions-instance) pair, even when both
     * `readPublishedVersion` and `publish` paths inspect the same pom.
     *
     * Previously a module-level WeakSet — but a module-level WeakSet
     * keeps its membership for the lifetime of the process, so across
     * multiple invocations of vis in the same process (long-running
     * daemons, REPL flows, the test harness reusing imports) the
     * warning would suppress on the second call against the same
     * WorkspacePackage identity, silently dropping a signal the
     * operator should see on every wave.
     *
     * Scoping to the instance gives programmatic-API users fresh
     * warning state every time they construct a `new MavenVersionActions()`.
     * The orchestrator constructs exactly one actions instance per
     * version-action kind per wave, so the "once per wave" guarantee
     * is preserved.
     */
    private readonly warnedMultiModule = new WeakSet<WorkspacePackage>();

    private warnIfMultiModule(pkg: WorkspacePackage, coordinates: PomCoordinates): void {
        if (!coordinates.hasModules || this.warnedMultiModule.has(pkg)) {
            return;
        }

        this.warnedMultiModule.add(pkg);

        process.stderr.write(
            `[vis release] ⚠ ${pkg.name} (${coordinates.groupId ?? "?"}:${coordinates.artifactId ?? "?"}) is a multi-module Maven project (<modules> present). `
            + "vis treats it as a single artifact for version-read + already-published checks. For proper reactor handling, "
            + "use `versionActions: \"shell\"` with `mvn -B -ntp deploy`.\n",
        );
    }

    /**
     * Read the current published version of the package from Maven Central.
     *
     * Flow:
     *   1. Resolve + read the pom.xml from disk.
     *   2. Parse `&lt;groupId>` + `&lt;artifactId>`. If either is missing, we
     *      can't construct a metadata URL — return undefined and let
     *      the orchestrator treat as "publish anyway".
     *   3. Honour `mavenMetadataUrl: ""` opt-out.
     *   4. `fetch()` the metadata XML. 404 → undefined (fresh package).
     *      Network failure → undefined (don't block the release for a
     *      transient registry hiccup; the publish step will fail loudly
     *      if the credentials / network are actually broken).
     *   5. Parse `&lt;latest>` (or fallback to last `&lt;version>` in `&lt;versions>`).
     */
    public async readPublishedVersion(context: {
        perPackageConfig?: MavenPerPackageConfig & PerPackageReleaseConfig;
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
        workspaceConfig?: import("../../types").VisReleaseConfig;
    }): Promise<string | undefined> {
        const perPkg = context.perPackageConfig ?? {};
        const pomPath = join(context.pkg.dir, perPkg.pomPath ?? "pom.xml");

        let xml: string;

        try {
            xml = await readFile(pomPath, "utf8");
        } catch {
            return undefined;
        }

        const coordinates = parsePomCoordinates(xml);

        this.warnIfMultiModule(context.pkg, coordinates);

        if (!coordinates.groupId || !coordinates.artifactId) {
            return undefined;
        }

        // Explicit opt-out (custom repo, auth-required, etc.) — caller
        // tells us not to bother with the metadata check.
        if (perPkg.mavenMetadataUrl === "") {
            return undefined;
        }

        const url = perPkg.mavenMetadataUrl ?? mavenCentralMetadataUrl(coordinates.groupId, coordinates.artifactId);

        try {
            // M-4 SSRF guard: `mavenMetadataUrl` is operator-configurable
            // and could be coerced into pointing at an internal host
            // (cloud metadata, intranet) that returns a 30x to a
            // sensitive endpoint. `safeFetchVersionMetadata` follows
            // up to 2 same-host redirects manually and treats anything
            // cross-host as a 404.
            const response = await safeFetchVersionMetadata(url, {
                // Maven Central serves XML as text/xml — Accept matches.
                headers: { Accept: "text/xml,application/xml;q=0.9,*/*;q=0.8" },
                httpProxy: context.workspaceConfig?.httpProxy,
            });

            if (response.status === 404) {
                return undefined;
            }

            if (!response.ok) {
                return undefined;
            }

            const body = await response.text();

            return parseMavenMetadataLatest(body);
        } catch {
            // Network error, DNS hiccup, etc. — fail-open. The publish
            // step will surface the real failure if it's persistent.
            return undefined;
        }
    }

    /**
     * NOT IMPLEMENTED — throws `CONFIG_INVALID` with the deferred-to-shell
     * workaround. See file header for the rationale.
     *
     * B-1: the error includes the resolved `groupId:artifactId` so a
     * log reader can locate the offending pom without grep-bouncing
     * across the workspace. If the pom can't be read or parsed
     * (deleted on disk, malformed XML), we fall back to the package
     * name — the operator still has enough to find the source.
     */
    public async publish(context: PublishContext): Promise<PublishResult> {
        const perPkg = context.perPackageConfig ?? {};
        const pomPath = join(context.pkg.dir, perPkg.pomPath ?? "pom.xml");

        // Best-effort pom read for the B-1 coordinate enrichment. A
        // failure here doesn't change the behaviour (publish still
        // throws); it just falls back to the package name in the hint.
        let coordinates: PomCoordinates | undefined;

        try {
            const xml = await readFile(pomPath, "utf8");

            coordinates = parsePomCoordinates(xml);
        } catch {
            coordinates = undefined;
        }

        const coordinateLabel = coordinates?.groupId && coordinates?.artifactId ? `${coordinates.groupId}:${coordinates.artifactId}` : context.pkg.name;

        if (context.dryRun) {
            // Honour dryRun so vis-release dry-runs don't blow up on
            // Maven packages. The native publish hasn't been written
            // yet; the dry-run is intrinsically a no-op anyway.
            return {
                output: `[dry-run / maven] would publish ${context.pkg.name}@${context.release.newVersion} (${coordinateLabel}) (native publish not yet implemented — would use shell path)`,
                published: true,
            };
        }

        // B-1: enrich the static MAVEN_PUBLISH_HINT with the resolved
        // coordinates so log readers can locate the offending pom
        // (`io.visulima:vis-jvm`) rather than grep-bouncing through
        // the workspace looking for the right package directory.
        const enrichedHint = `Failing artifact: ${coordinateLabel}\nPom: ${pomPath}\n\n${MAVEN_PUBLISH_HINT}`;

        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: enrichedHint,
            message: `Native Maven publishing is not implemented for ${context.pkg.name}@${context.release.newVersion} (${coordinateLabel}). Use \`versionActions: "shell"\` with \`mvn deploy\` until the Sonatype Central Portal client lands.`,
            packageName: context.pkg.name,
        });
    }
}
