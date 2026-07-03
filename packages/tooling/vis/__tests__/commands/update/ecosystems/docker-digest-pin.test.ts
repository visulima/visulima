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

const fetchHubTags = (tags: string[]): typeof fetch =>
    vi.fn(async () =>
        Response.json(
            {
                next: null,
                results: tags.map((tag) => {
                    return { name: tag };
                }),
            },
            { status: 200 },
        ),
    );

const DIGEST_PINNED: ImageReference = {
    digest: "sha256:abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc",
    file: "/tmp/Dockerfile",
    ignoreReason: undefined,
    kind: "dockerfile",
    line: 1,
    name: "node",
    namespace: "library",
    original: "node:18@sha256:abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc",
    registry: "docker.io",
    tag: "18",
};

describe("docker orchestrator — digest-pinned image", () => {
    it("refuses to update a digest-pinned image (would silently strip the supply-chain pin)", async () => {
        expect.assertions(3);

        const result = await checkDocker("/tmp", {
            options: baseOptions,
            references: [DIGEST_PINNED],
            registryOptions: { fetch: fetchHubTags(["20", "22"]) },
        });

        expect(result.updates).toHaveLength(0);
        expect(result.ignored[0]?.reason).toContain("digest-pinned");
        expect(result.ignored[0]?.updateType).toBe("digest");
    });
});
