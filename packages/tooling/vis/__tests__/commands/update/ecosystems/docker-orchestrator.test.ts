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

const reference = (overrides: Partial<ImageReference> = {}): ImageReference => ({
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
});

const fetchHubTags = (tags: string[]): typeof fetch =>
    vi.fn(async () => new Response(JSON.stringify({ next: null, results: tags.map((tag) => ({ name: tag })) }), { status: 200 })) as typeof fetch;

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
});
