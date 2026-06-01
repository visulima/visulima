import { describe, expect, it, vi } from "vitest";

import { checkDocker } from "../../../../src/commands/update/ecosystems/docker/index";
import type { ImageReference } from "../../../../src/commands/update/ecosystems/docker/scanner";
import type { EcosystemUpdateOptions } from "../../../../src/commands/update/ecosystems/types";

const baseOptions: EcosystemUpdateOptions = {
    disabled: new Set(),
    exclude: [],
    githubToken: undefined,
    gitlabToken: undefined,
    include: [],
    includeBranches: false,
    maxConcurrentRequests: 4,
    minAgeDays: undefined,
    mode: "latest",
    respectDependabotConfig: false,
    style: "sha",
};

const reference = (overrides: Partial<ImageReference> = {}): ImageReference => {
    return {
        digest: undefined,
        file: "/tmp/Dockerfile",
        ignoreReason: undefined,
        kind: "dockerfile",
        line: 1,
        name: "node",
        namespace: "library",
        original: "node:18",
        registry: "docker.io",
        tag: "18",
        ...overrides,
    };
};

const fetchHubTags = (tags: string[]): typeof fetch =>
    vi.fn(async () => Response.json({ next: null, results: tags.map((tag) => { return { name: tag }; }) }, { status: 200 }));

const fetchHubTagsWithDates = (entries: { lastUpdated: string; name: string }[]): typeof fetch =>
    vi.fn(
        async () =>
            Response.json({ next: null, results: entries.map((entry) => { return { last_updated: entry.lastUpdated, name: entry.name }; }) }, {
                status: 200,
            }),
    );

describe(checkDocker, () => {
    it("emits an update with the docker.io display name and a hub.docker.com URL", async () => {
        expect.assertions(3);

        const result = await checkDocker("/tmp", {
            options: baseOptions,
            references: [reference()],
            registryOptions: { fetch: fetchHubTags(["20", "22", "18"]) },
        });

        expect(result.updates).toHaveLength(1);
        expect(result.updates[0]?.name).toBe("node");
        expect(result.updates[0]?.url).toContain("hub.docker.com/_/node");
    });

    it("skips `latest` and other non-semver tags unless --include-branches", async () => {
        expect.assertions(1);

        const result = await checkDocker("/tmp", {
            options: baseOptions,
            references: [reference({ original: "node:latest", tag: "latest" })],
            registryOptions: { fetch: fetchHubTags(["20", "22"]) },
        });

        expect(result.ignored[0]?.reason).toBe("non-semver tag (use --include-branches)");
    });

    it("classifies the bump type correctly", async () => {
        expect.assertions(1);

        const result = await checkDocker("/tmp", {
            options: baseOptions,
            references: [reference()],
            registryOptions: { fetch: fetchHubTags(["22"]) },
        });

        expect(result.updates[0]?.updateType).toBe("major");
    });

    it("drops updates younger than --min-age-days when Docker Hub reports last_updated", async () => {
        expect.assertions(4);

        const today = new Date().toISOString();

        const result = await checkDocker("/tmp", {
            options: { ...baseOptions, minAgeDays: 7 },
            references: [reference()],
            registryOptions: { fetch: fetchHubTagsWithDates([{ lastUpdated: today, name: "22" }]) },
        });

        expect(result.updates).toHaveLength(0);
        expect(result.ignored[0]?.reason).toBe("release younger than 7 days");
        expect(result.ignored[0]?.newVersion).toBe("22");
        // newRef must mirror newVersion (post-bump candidate), not the
        // current reference — pre-bump newRef would confuse --show-ignored.
        expect(result.ignored[0]?.newRef).toBe("22");
    });

    it("keeps updates older than --min-age-days", async () => {
        expect.assertions(1);

        const ancient = new Date(Date.now() - 30 * 86_400_000).toISOString();

        const result = await checkDocker("/tmp", {
            options: { ...baseOptions, minAgeDays: 7 },
            references: [reference()],
            registryOptions: { fetch: fetchHubTagsWithDates([{ lastUpdated: ancient, name: "22" }]) },
        });

        expect(result.updates).toHaveLength(1);
    });

    it("falls through the min-age gate silently when the registry omits a timestamp (v2)", async () => {
        expect.assertions(1);

        const result = await checkDocker("/tmp", {
            options: { ...baseOptions, minAgeDays: 7 },
            references: [reference()],
            registryOptions: { fetch: fetchHubTags(["22"]) },
        });

        expect(result.updates).toHaveLength(1);
    });
});
