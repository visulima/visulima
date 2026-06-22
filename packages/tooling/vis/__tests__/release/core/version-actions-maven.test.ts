import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import {
    mavenCentralMetadataUrl,
    MavenVersionActions,
    parseMavenMetadataLatest,
    parsePomCoordinates,
} from "../../../src/release/core/version-actions/maven";
import type { WorkspacePackage } from "../../../src/release/types";

/**
 * MavenVersionActions — Stage 3 SKELETON.
 *
 * Contract under test:
 *   1. parsePomCoordinates extracts groupId/artifactId/version from a
 *      pom.xml without choking on parent or dependency `&lt;version>` tags.
 *   2. parseMavenMetadataLatest prefers `&lt;latest>` and falls back to the
 *      last `&lt;version>` in `&lt;versions>`.
 *   3. readPublishedVersion fetches Maven Central, returns the parsed
 *      latest on 200, undefined on 404 / network errors.
 *   4. Multi-module poms emit a warning to stderr.
 *   5. publish() throws CONFIG_INVALID with a shell-path hint (the
 *      native Central Portal upload flow is deferred).
 *   6. dryRun is honoured even though publish isn't implemented yet.
 */

const POM_SIMPLE = `<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>io.visulima</groupId>
    <artifactId>vis-jvm</artifactId>
    <version>1.2.3</version>
    <packaging>jar</packaging>
</project>`;

const POM_WITH_PARENT = `<?xml version="1.0"?>
<project>
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>
    <groupId>io.visulima</groupId>
    <artifactId>vis-jvm</artifactId>
    <version>1.2.3</version>
    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>example</artifactId>
            <version>9.9.9</version>
        </dependency>
    </dependencies>
</project>`;

const POM_MULTI_MODULE = `<?xml version="1.0"?>
<project>
    <groupId>io.visulima</groupId>
    <artifactId>vis-jvm-parent</artifactId>
    <version>1.2.3</version>
    <packaging>pom</packaging>
    <modules>
        <module>core</module>
        <module>api</module>
    </modules>
</project>`;

const METADATA_WITH_LATEST = `<?xml version="1.0"?>
<metadata>
    <groupId>io.visulima</groupId>
    <artifactId>vis-jvm</artifactId>
    <versioning>
        <latest>1.2.4</latest>
        <release>1.2.4</release>
        <versions>
            <version>1.0.0</version>
            <version>1.2.3</version>
            <version>1.2.4</version>
        </versions>
    </versioning>
</metadata>`;

const METADATA_NO_LATEST = `<?xml version="1.0"?>
<metadata>
    <versioning>
        <versions>
            <version>0.9.0</version>
            <version>1.0.0</version>
        </versions>
    </versioning>
</metadata>`;

const buildPkg = (dir: string): WorkspacePackage => {
    return {
        dir,
        manifest: { name: "@scope/jvm", version: "1.2.3" },
        manifestPath: `${dir}/package.json`,
        name: "@scope/jvm",
        private: false,
        version: "1.2.3",
    };
};

const buildPublishContext = (overrides: { dryRun?: boolean; newVersion?: string; pkg: WorkspacePackage }): PublishContext => {
    return {
        catalogs: { default: {}, named: {} },
        dryRun: overrides.dryRun,
        pkg: overrides.pkg,
        pm: {
            id: "npm",
            minVersion: "8.0.0",
            runner: { run: async () => { return { exitCode: 0, stderr: "", stdout: "" }; } } as CommandRunner,
        } as never,
        release: {
            changeFiles: [],
            isCascadeBump: false,
            isDependencyBump: false,
            isGroupBump: false,
            name: overrides.pkg.name,
            newVersion: overrides.newVersion ?? "1.2.4",
            oldVersion: overrides.pkg.version,
            reasons: ["EXPLICIT"],
            sources: [],
            type: "patch",
        },
        versionedManifestByName: new Map(),
    };
};

describe(parsePomCoordinates, () => {
    it("extracts groupId / artifactId / version from a simple pom", () => {
        const result = parsePomCoordinates(POM_SIMPLE);

        expect(result.groupId).toBe("io.visulima");
        expect(result.artifactId).toBe("vis-jvm");
        expect(result.version).toBe("1.2.3");
        expect(result.hasModules).toBe(false);
    });

    it("skips <parent> + <dependency> version tags and finds the project version", () => {
        const result = parsePomCoordinates(POM_WITH_PARENT);

        // 1.2.3 is the project version; 3.2.0 / 9.9.9 are the parent + dep
        // versions which must NOT win.
        expect(result.version).toBe("1.2.3");
        expect(result.groupId).toBe("io.visulima");
        expect(result.artifactId).toBe("vis-jvm");
    });

    it("flags multi-module reactor projects via hasModules", () => {
        const result = parsePomCoordinates(POM_MULTI_MODULE);

        expect(result.hasModules).toBe(true);
        expect(result.version).toBe("1.2.3");
    });

    it("ignores commented-out version tags", () => {
        const xml = `<project>
            <groupId>a.b</groupId>
            <artifactId>c</artifactId>
            <!-- <version>9.9.9</version>  obsolete -->
            <version>2.0.0</version>
        </project>`;

        const result = parsePomCoordinates(xml);

        expect(result.version).toBe("2.0.0");
    });
});

describe(parseMavenMetadataLatest, () => {
    it("prefers <latest>", () => {
        expect(parseMavenMetadataLatest(METADATA_WITH_LATEST)).toBe("1.2.4");
    });

    it("falls back to the last <version> in <versions> when <latest> is missing", () => {
        expect(parseMavenMetadataLatest(METADATA_NO_LATEST)).toBe("1.0.0");
    });

    it("returns undefined for malformed metadata", () => {
        expect(parseMavenMetadataLatest("<metadata />")).toBeUndefined();
    });
});

describe(mavenCentralMetadataUrl, () => {
    it("translates dotted groupId into slash path", () => {
        expect(mavenCentralMetadataUrl("io.visulima", "vis-jvm")).toBe(
            "https://repo1.maven.org/maven2/io/visulima/vis-jvm/maven-metadata.xml",
        );
    });
});

describe("mavenVersionActions.readPublishedVersion", () => {
    let pkgDir: string;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        pkgDir = mkdtempSync(join(tmpdir(), "vis-maven-test-"));
        writeFileSync(join(pkgDir, "pom.xml"), POM_SIMPLE);
    });

    afterEach(() => {
        rmSync(pkgDir, { force: true, recursive: true });
        globalThis.fetch = originalFetch;
    });

    it("returns the metadata <latest> for an existing artifact", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => METADATA_WITH_LATEST,
        }) as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBe("1.2.4");
        expect(globalThis.fetch).toHaveBeenCalledWith(
            "https://repo1.maven.org/maven2/io/visulima/vis-jvm/maven-metadata.xml",
            expect.objectContaining({ headers: expect.any(Object) }),
        );
    });

    it("returns undefined on 404 (fresh artifact)", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => "",
        }) as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when the network errors (fail-open)", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
    });

    it("returns undefined when the pom is missing", async () => {
        const emptyDir = mkdtempSync(join(tmpdir(), "vis-maven-empty-"));

        try {
            const actions = new MavenVersionActions();
            const result = await actions.readPublishedVersion({
                pkg: buildPkg(emptyDir),
                pm: { runner: {} as CommandRunner } as never,
            });

            expect(result).toBeUndefined();
        } finally {
            rmSync(emptyDir, { force: true, recursive: true });
        }
    });

    it("warns to stderr when the pom declares <modules>", async () => {
        writeFileSync(join(pkgDir, "pom.xml"), POM_MULTI_MODULE);
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => METADATA_WITH_LATEST,
        }) as never;

        const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        const actions = new MavenVersionActions();

        await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        // The warning is emitted at least once and mentions multi-module.
        const calls = writeSpy.mock.calls.map((c) => String(c[0]));

        expect(calls.some((c) => c.includes("multi-module"))).toBe(true);

        writeSpy.mockRestore();
    });

    it("honours mavenMetadataUrl: \"\" to disable the metadata check", async () => {
        const fetchSpy = vi.fn();

        globalThis.fetch = fetchSpy as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            perPackageConfig: { mavenMetadataUrl: "" },
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("stamps a vis-release User-Agent on the metadata request (B-3)", async () => {
        // B-3: every registry-probe fetch carries a contact UA.
        const fetchSpy = vi.fn().mockResolvedValue({
            headers: new Headers(),
            ok: true,
            status: 200,
            text: async () => METADATA_WITH_LATEST,
        });

        globalThis.fetch = fetchSpy as never;

        const actions = new MavenVersionActions();

        await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const init = fetchSpy.mock.calls[0]![1] as RequestInit | undefined;
        const headers = init?.headers as Record<string, string> | undefined;

        expect(headers).toBeDefined();
        expect(headers!["User-Agent"]).toMatch(/^vis-release\//);
        // SSRF guard: every probe uses manual redirect handling.
        expect(init?.redirect).toBe("manual");
    });

    it("follows up to 2 same-host redirects (M-4 SSRF guard)", async () => {
        // M-4: when Maven Central's CDN normalises a path with a 301,
        // we want to follow IF the target stays on the same host.
        let call = 0;
        const fetchSpy = vi.fn().mockImplementation(async (_url: string) => {
            call += 1;

            if (call === 1) {
                // First request gets a 301 → same host, different path.
                return {
                    headers: new Headers({
                        // Same host, just a path normalisation.
                        location: "https://repo1.maven.org/maven2/io/visulima/vis-jvm/canonical/maven-metadata.xml",
                    }),
                    ok: false,
                    status: 301,
                    text: async () => "",
                };
            }

            // Second request (post-redirect) returns the metadata.
            return {
                headers: new Headers(),
                ok: true,
                status: 200,
                text: async () => METADATA_WITH_LATEST,
            };
        });

        globalThis.fetch = fetchSpy as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBe("1.2.4");
        // Manual redirect: vis made TWO calls (original + 1 follow).
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("refuses to follow cross-host redirects (M-4 SSRF guard)", async () => {
        // M-4 SSRF guard: a user-configurable `mavenMetadataUrl`
        // (per-package override) that points at an internal host —
        // or any URL coerced into redirecting to one — must be
        // treated as a 404 rather than silently following the 30x.
        // This protects against cloud-metadata exfil, intranet
        // probing, etc.
        const fetchSpy = vi.fn().mockResolvedValueOnce({
            headers: new Headers({
                // Cross-host redirect → SSRF risk → reject.
                location: "http://169.254.169.254/latest/meta-data/",
            }),
            ok: false,
            status: 302,
            text: async () => "",
        });

        globalThis.fetch = fetchSpy as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
        // We made the initial request but did NOT follow the redirect
        // — the cross-host check kicked in.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("stops after 2 same-host redirects to bound chains (M-4 SSRF guard)", async () => {
        // Bounded chain — at most 2 follows. The 3rd 301 in a row
        // surfaces as "unknown" rather than continuing indefinitely.
        const fetchSpy = vi.fn().mockResolvedValue({
            headers: new Headers({
                location: "https://repo1.maven.org/maven2/io/visulima/vis-jvm/loop/maven-metadata.xml",
            }),
            ok: false,
            status: 301,
            text: async () => "",
        });

        globalThis.fetch = fetchSpy as never;

        const actions = new MavenVersionActions();
        const result = await actions.readPublishedVersion({
            pkg: buildPkg(pkgDir),
            pm: { runner: {} as CommandRunner } as never,
        });

        expect(result).toBeUndefined();
        // Original + 2 same-host follows = 3 calls; the 3rd response
        // is the redirect that gets capped (no 4th call).
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
});

describe("mavenVersionActions.publish", () => {
    let pkgDir: string;

    beforeEach(() => {
        pkgDir = mkdtempSync(join(tmpdir(), "vis-maven-pub-"));
        writeFileSync(join(pkgDir, "pom.xml"), POM_SIMPLE);
    });

    afterEach(() => {
        rmSync(pkgDir, { force: true, recursive: true });
    });

    it("returns published: true in dryRun mode without throwing", async () => {
        const actions = new MavenVersionActions();
        const result = await actions.publish(buildPublishContext({ dryRun: true, pkg: buildPkg(pkgDir) }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[dry-run / maven]");
    });

    it("throws CONFIG_INVALID with the shell-path workaround hint", async () => {
        const actions = new MavenVersionActions();

        await expect(actions.publish(buildPublishContext({ pkg: buildPkg(pkgDir) }))).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            hint: expect.stringContaining("mvn"),
        });
    });

    it("error mentions the docs guide for the full operator setup", async () => {
        const actions = new MavenVersionActions();

        await expect(actions.publish(buildPublishContext({ pkg: buildPkg(pkgDir) }))).rejects.toMatchObject({
            hint: expect.stringContaining("docs/guides/release-maven.mdx"),
        });
    });

    it("stable id is `maven`", () => {
        expect(new MavenVersionActions().id).toBe("maven");
    });

    it("includes the resolved groupId:artifactId in the CONFIG_INVALID error (B-1)", async () => {
        // B-1: the static hint used to leave operators grep-bouncing
        // across the workspace to find the offending pom. The publish
        // error now stamps `groupId:artifactId` (and the resolved pom
        // path) so the log line points straight at the source.
        const actions = new MavenVersionActions();
        const pkg = buildPkg(pkgDir);

        await expect(actions.publish(buildPublishContext({ pkg }))).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            hint: expect.stringContaining("io.visulima:vis-jvm"),
            message: expect.stringContaining("io.visulima:vis-jvm"),
        });
    });

    it("falls back to the package name when the pom can't be parsed (B-1)", async () => {
        // Best-effort pom read: a missing/malformed pom doesn't change
        // the error class, but the coordinate label degrades to the
        // package name so the operator still has SOMETHING to grep.
        const emptyDir = mkdtempSync(join(tmpdir(), "vis-maven-no-pom-"));

        try {
            const actions = new MavenVersionActions();
            const pkg = buildPkg(emptyDir);

            await expect(actions.publish(buildPublishContext({ pkg }))).rejects.toMatchObject({
                code: "CONFIG_INVALID",
                message: expect.stringContaining("@scope/jvm"),
            });
        } finally {
            rmSync(emptyDir, { force: true, recursive: true });
        }
    });

    it("includes the resolved pom path in the hint (B-1)", async () => {
        const actions = new MavenVersionActions();
        const pkg = buildPkg(pkgDir);

        await expect(actions.publish(buildPublishContext({ pkg }))).rejects.toMatchObject({
            hint: expect.stringContaining("pom.xml"),
        });
    });
});

describe("mavenVersionActions instance state (N-5)", () => {
    // N-5: previously the multi-module warning state lived in a
    // module-level WeakSet that persisted across vis invocations in
    // the same process. Long-running daemons / REPL flows / the
    // test harness reusing imports would see the warning suppressed
    // on the SECOND wave through. Scoping the set to the actions
    // instance restores the "once per wave" intent — a fresh
    // instance has fresh warning state.
    let pkgDir: string;

    const POM_MULTI = `<?xml version="1.0"?>
<project>
    <groupId>io.visulima</groupId>
    <artifactId>vis-jvm-parent</artifactId>
    <version>1.2.3</version>
    <modules>
        <module>core</module>
    </modules>
</project>`;

    beforeEach(() => {
        pkgDir = mkdtempSync(join(tmpdir(), "vis-maven-instance-"));
        writeFileSync(join(pkgDir, "pom.xml"), POM_MULTI);
        globalThis.fetch = vi.fn().mockResolvedValue({
            headers: new Headers(),
            ok: true,
            status: 200,
            text: async () => "<metadata />",
        }) as never;
    });

    afterEach(() => {
        rmSync(pkgDir, { force: true, recursive: true });
    });

    it("emits the multi-module warning once per actions instance", async () => {
        const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        const actions = new MavenVersionActions();
        const pkg = buildPkg(pkgDir);

        await actions.readPublishedVersion({
            pkg,
            pm: { runner: {} as CommandRunner } as never,
        });
        // Second call against the SAME instance + pkg should be silent.
        await actions.readPublishedVersion({
            pkg,
            pm: { runner: {} as CommandRunner } as never,
        });

        const multiModuleWarnings = writeSpy.mock.calls
            .map((c) => String(c[0]))
            .filter((s) => s.includes("multi-module"));

        expect(multiModuleWarnings).toHaveLength(1);

        writeSpy.mockRestore();
    });

    it("re-emits the multi-module warning on a fresh actions instance (N-5)", async () => {
        // The whole point of N-5: a programmatic-API caller constructing
        // a new MavenVersionActions for a second release wave (e.g. a
        // long-running daemon, REPL session, or test harness reusing
        // module imports) gets the warning again. Previously the
        // module-level WeakSet ate it.
        const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        const pkg = buildPkg(pkgDir);

        const actions1 = new MavenVersionActions();

        await actions1.readPublishedVersion({
            pkg,
            pm: { runner: {} as CommandRunner } as never,
        });

        // Fresh instance — simulates a second vis invocation in the
        // same process. Same package identity is fine; the warning
        // suppression key is scoped to the instance.
        const actions2 = new MavenVersionActions();

        await actions2.readPublishedVersion({
            pkg,
            pm: { runner: {} as CommandRunner } as never,
        });

        const multiModuleWarnings = writeSpy.mock.calls
            .map((c) => String(c[0]))
            .filter((s) => s.includes("multi-module"));

        // One warning from actions1, one from actions2 — total of TWO.
        expect(multiModuleWarnings).toHaveLength(2);

        writeSpy.mockRestore();
    });
});

describe("parsePomCoordinates regex sharing (B-4)", () => {
    // B-4: the parsing regexes are hoisted to module-level constants.
    // This test pins the behaviour against the previous "construct
    // inline on every call" implementation — parsing the same pom 100
    // times must produce identical results without state contamination
    // (the hoisted regexes are stateless — no `g` flag — so safe to share).
    it("yields identical coordinates across repeated calls (regex statelessness)", () => {
        const xml = `<project>
            <groupId>a.b</groupId>
            <artifactId>c</artifactId>
            <version>1.0.0</version>
        </project>`;

        const results = Array.from({ length: 100 }, () => parsePomCoordinates(xml));

        for (const result of results) {
            expect(result).toStrictEqual({
                artifactId: "c",
                groupId: "a.b",
                hasModules: false,
                version: "1.0.0",
            });
        }
    });
});
