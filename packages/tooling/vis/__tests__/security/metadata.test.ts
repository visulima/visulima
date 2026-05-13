import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMetadataMarshall } from "../../src/security/marshalls/metadata";
import { clearPackumentCache } from "../../src/security/marshalls/packument";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (response: { body?: unknown; status?: number }): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => response.body ?? {},
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        };
    },
    );

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packumentWith = (entry: Record<string, unknown>, rootReadme?: string): Record<string, unknown> => {
    return {
        "dist-tags": { latest: "1.0.0" },
        name: "demo",
        ...(rootReadme === undefined ? {} : { readme: rootReadme }),
        versions: {
            "1.0.0": { version: "1.0.0", ...entry },
        },
    };
};

describe(runMetadataMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-metadata-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns no findings when all metadata is present", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                readme: "# demo\n\nA real README.",
                repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("flags a placeholder README", async () => {
        expect.assertions(2);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                readme: "ERROR: No README data found!",
                repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]?.issues).toContain("placeholder-readme");
    });

    it("flags the npm holding-package README prefix", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                readme: "# Security holding package\n\nDo not install.",
                repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.issues).toContain("placeholder-readme");
    });

    it("flags a missing README", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.issues).toContain("missing-readme");
    });

    it("accepts a root-level readme when the per-version entry omits it", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith(
                {
                    license: "MIT",
                    repository: { type: "git", url: "git+https://github.com/example/demo.git" },
                },
                "# demo\n\nA real README.",
            ),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("flags a missing license", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                readme: "# demo\n\nReal content.",
                repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.issues).toContain("missing-license");
    });

    it("accepts the deprecated `{ type, url }` license form", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: { type: "MIT", url: "https://opensource.org/licenses/MIT" },
                readme: "# demo\n\nReal content.",
                repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("flags a missing repo entirely", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                readme: "# demo\n\nReal content.",
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.issues).toContain("missing-repo");
    });

    it("flags an invalid repository.url that fails URL parsing", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                readme: "# demo\n\nReal content.",
                repository: { url: "not a url" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.issues).toContain("invalid-repo-url");
    });

    it("accepts git@ ssh shorthand as a valid repo URL", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                license: "MIT",
                readme: "# demo\n\nReal content.",
                repository: { url: "git@github.com:example/demo.git" },
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("exempts private packages from metadata findings", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({ private: true }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("filters to the configured check subset", async () => {
        expect.assertions(2);

        stubFetch({
            body: packumentWith({
                // Everything is missing — only license should fire when checks=['license'].
            }),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }], { checks: ["license"] });

        expect(findings).toHaveLength(1);
        expect(findings[0]?.issues).toStrictEqual(["missing-license"]);
    });

    it("respects the allowlist", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({}),
        });

        const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
    });

    it("returns an empty array when MARSHALL_DISABLE_METADATA is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_METADATA;
        const fetchSpy = stubFetch({ body: packumentWith({}) });

        try {
            process.env.MARSHALL_DISABLE_METADATA = "1";

            const findings = await runMetadataMarshall([{ name: "demo", version: "1.0.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_METADATA;
            } else {
                process.env.MARSHALL_DISABLE_METADATA = previous;
            }
        }
    });
});
