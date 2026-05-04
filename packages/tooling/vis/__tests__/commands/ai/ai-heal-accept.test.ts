import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Toolbox } from "@visulima/cerebro";
import { describe, expect, it, vi } from "vitest";

import type { CiContext } from "../../../src/ai/ci-context";
import {
    fetchGithubHeadRefForTesting,
    loadGithubTriggerForTesting,
    loadGitlabTriggerForTesting,
    runHealAcceptForTesting,
    summariseDetailForTesting,
    TRIGGER_PHRASE,
} from "../../../src/commands/ai/heal-accept";
import type { AiHealAcceptOptions } from "../../../src/commands/ai/index";

const fakeToolbox = (overrides: Partial<{
    options: Partial<{ run: string | undefined; validationTimeout: number | undefined }>;
    visConfig: { ai?: { heal?: { allowedActors?: string[] } } } | undefined;
    workspaceRoot: string;
}> = {}): Toolbox<Console, AiHealAcceptOptions> => {
    const baseOptions = {
        run: undefined as string | undefined,
        validationTimeout: undefined as number | undefined,
        ...overrides.options,
    };

    return {
        argument: [],
        argv: [],
        command: { name: "accept" } as never,
        commandName: "accept",
        env: {},
        logger: console,
        options: baseOptions as unknown as AiHealAcceptOptions,
        projectRoot: undefined,
        runtimeFlags: {},
        visConfig: overrides.visConfig ?? { ai: { heal: { allowedActors: ["alice"] } } },
        workspaceRoot: overrides.workspaceRoot ?? "/ws",
    } as unknown as Toolbox<Console, AiHealAcceptOptions>;
};

const githubCi = (overrides: Partial<CiContext> = {}): CiContext => {
    return {
        apiBaseUrl: undefined,
        prNumber: 42,
        provider: "github-actions",
        repo: "owner/repo",
        sha: "abc",
        token: "ghs_test",
        ...overrides,
    };
};

describe(loadGithubTriggerForTesting, () => {
    it("should parse comment body and author from issue_comment payload", async () => {
        expect.assertions(3);

        const directory = mkdtempSync(join(tmpdir(), "vis-trigger-"));

        try {
            const eventPath = join(directory, "event.json");

            writeFileSync(
                eventPath,
                JSON.stringify({
                    action: "created",
                    comment: { body: `${TRIGGER_PHRASE}`, user: { login: "alice" } },
                    issue: { number: 42, pull_request: {} },
                    repository: { full_name: "owner/repo" },
                }),
            );

            const trigger = await loadGithubTriggerForTesting(eventPath);

            expect(trigger?.actor).toBe("alice");
            expect(trigger?.body).toContain(TRIGGER_PHRASE);
            expect(trigger?.isFork).toBe(false);
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("should detect fork PRs by comparing head.repo to base.repo", async () => {
        expect.assertions(2);

        const directory = mkdtempSync(join(tmpdir(), "vis-trigger-"));

        try {
            const eventPath = join(directory, "event.json");

            writeFileSync(
                eventPath,
                JSON.stringify({
                    comment: { body: TRIGGER_PHRASE, user: { login: "mallory" } },
                    pull_request: {
                        base: { repo: { full_name: "owner/repo" } },
                        head: { ref: "evil/branch", repo: { full_name: "fork/repo" } },
                        number: 42,
                    },
                    repository: { full_name: "owner/repo" },
                }),
            );

            const trigger = await loadGithubTriggerForTesting(eventPath);

            expect(trigger?.isFork).toBe(true);
            expect(trigger?.headRef).toBe("evil/branch");
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("should return undefined when the event file is missing", async () => {
        expect.assertions(1);
        expect(await loadGithubTriggerForTesting("/no/such/path.json")).toBeUndefined();
    });
});

describe(loadGitlabTriggerForTesting, () => {
    it("should require both VIS_HEAL_TRIGGER_BODY and VIS_HEAL_TRIGGER_ACTOR", () => {
        expect.assertions(2);

        expect(loadGitlabTriggerForTesting({ VIS_HEAL_TRIGGER_BODY: TRIGGER_PHRASE })).toBeUndefined();
        expect(loadGitlabTriggerForTesting({ VIS_HEAL_TRIGGER_ACTOR: "alice" })).toBeUndefined();
    });

    it("should pass through the head ref when supplied", () => {
        expect.assertions(3);

        const trigger = loadGitlabTriggerForTesting({
            VIS_HEAL_HEAD_REF: "topic/x",
            VIS_HEAL_TRIGGER_ACTOR: "alice",
            VIS_HEAL_TRIGGER_BODY: TRIGGER_PHRASE,
        });

        expect(trigger?.actor).toBe("alice");
        expect(trigger?.headRef).toBe("topic/x");
        expect(trigger?.isFork).toBe(false);
    });
});

describe(fetchGithubHeadRefForTesting, () => {
    it("should hit the pulls endpoint and pick out head.ref", async () => {
        expect.assertions(2);

        const fetchImpl = vi.fn(async () =>
            Response.json({ head: { ref: "feat/cool" } }, { status: 200 }),
        );

        const ref = await fetchGithubHeadRefForTesting({
            fetchImpl: fetchImpl as unknown as typeof fetch,
            prNumber: 42,
            repo: "owner/repo",
            token: "ghs_test",
        });

        expect(ref).toBe("feat/cool");
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/repo/pulls/42",
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer ghs_test" }) }),
        );
    });

    it("should return undefined on non-2xx", async () => {
        expect.assertions(1);

        const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));

        expect(
            await fetchGithubHeadRefForTesting({
                fetchImpl: fetchImpl as unknown as typeof fetch,
                prNumber: 42,
                repo: "owner/repo",
                token: "ghs_test",
            }),
        ).toBeUndefined();
    });
});

describe(summariseDetailForTesting, () => {
    it("should include actor, task ID, commit short SHA, and file list", () => {
        expect.assertions(4);

        const body = summariseDetailForTesting(
            { sha: "abcdef0123", url: "https://github.com/owner/repo/commit/abcdef0123" },
            ["src/a.ts", "src/b.ts"],
            "myapp:test",
            "alice",
        );

        expect(body).toContain("@alice");
        expect(body).toContain("`myapp:test`");
        expect(body).toContain("abcdef0");
        expect(body).toContain("- `src/a.ts`");
    });
});

describe(runHealAcceptForTesting, () => {
    it("should refuse to run outside a recognised CI provider", async () => {
        expect.assertions(1);

        const exitBefore = process.exitCode;

        try {
            await runHealAcceptForTesting(fakeToolbox(), {
                detectCi: async () => ({
                    apiBaseUrl: undefined,
                    prNumber: undefined,
                    provider: "unknown",
                    repo: undefined,
                    sha: undefined,
                    token: undefined,
                }),
                env: {},
            });

            expect(process.exitCode).toBe(1);
        } finally {
            process.exitCode = exitBefore;
        }
    });

    it("should refuse when the trigger payload is missing", async () => {
        expect.assertions(1);

        const exitBefore = process.exitCode;

        try {
            await runHealAcceptForTesting(fakeToolbox(), {
                detectCi: async () => githubCi(),
                // GITHUB_EVENT_PATH unset → loadGithubTrigger returns undefined.
                env: {},
            });

            expect(process.exitCode).toBe(1);
        } finally {
            process.exitCode = exitBefore;
        }
    });

    it("should be a no-op (exit 0) when the comment doesn't contain the trigger phrase", async () => {
        expect.assertions(1);

        const directory = mkdtempSync(join(tmpdir(), "vis-trigger-"));

        try {
            const eventPath = join(directory, "event.json");

            writeFileSync(eventPath, JSON.stringify({ comment: { body: "lgtm", user: { login: "alice" } } }));

            const exitBefore = process.exitCode;

            try {
                await runHealAcceptForTesting(fakeToolbox(), {
                    detectCi: async () => githubCi(),
                    env: { GITHUB_EVENT_PATH: eventPath },
                });

                // The phrase isn't in the comment — accept is a no-op,
                // process.exitCode stays untouched.
                expect(process.exitCode).toBe(exitBefore);
            } finally {
                process.exitCode = exitBefore;
            }
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("should refuse when ai.heal.allowedActors is empty", async () => {
        expect.assertions(1);

        const directory = mkdtempSync(join(tmpdir(), "vis-trigger-"));

        try {
            const eventPath = join(directory, "event.json");

            writeFileSync(
                eventPath,
                JSON.stringify({ comment: { body: TRIGGER_PHRASE, user: { login: "alice" } } }),
            );

            const exitBefore = process.exitCode;

            try {
                await runHealAcceptForTesting(
                    fakeToolbox({ visConfig: { ai: { heal: { allowedActors: [] } } } }),
                    {
                        detectCi: async () => githubCi(),
                        env: { GITHUB_EVENT_PATH: eventPath },
                    },
                );

                expect(process.exitCode).toBe(1);
            } finally {
                process.exitCode = exitBefore;
            }
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("should refuse when the actor is not in the allow-list", async () => {
        expect.assertions(1);

        const directory = mkdtempSync(join(tmpdir(), "vis-trigger-"));

        try {
            const eventPath = join(directory, "event.json");

            writeFileSync(
                eventPath,
                JSON.stringify({ comment: { body: TRIGGER_PHRASE, user: { login: "mallory" } } }),
            );

            const exitBefore = process.exitCode;

            try {
                await runHealAcceptForTesting(
                    fakeToolbox({ visConfig: { ai: { heal: { allowedActors: ["alice"] } } } }),
                    {
                        detectCi: async () => githubCi(),
                        env: { GITHUB_EVENT_PATH: eventPath },
                    },
                );

                expect(process.exitCode).toBe(1);
            } finally {
                process.exitCode = exitBefore;
            }
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("should refuse fork PRs even when the actor is allow-listed", async () => {
        expect.assertions(1);

        const directory = mkdtempSync(join(tmpdir(), "vis-trigger-"));

        try {
            const eventPath = join(directory, "event.json");

            writeFileSync(
                eventPath,
                JSON.stringify({
                    comment: { body: TRIGGER_PHRASE, user: { login: "alice" } },
                    pull_request: {
                        base: { repo: { full_name: "owner/repo" } },
                        head: { ref: "evil/branch", repo: { full_name: "fork/repo" } },
                        number: 42,
                    },
                }),
            );

            const exitBefore = process.exitCode;

            try {
                await runHealAcceptForTesting(
                    fakeToolbox({ visConfig: { ai: { heal: { allowedActors: ["alice"] } } } }),
                    {
                        detectCi: async () => githubCi(),
                        env: { GITHUB_EVENT_PATH: eventPath },
                    },
                );

                expect(process.exitCode).toBe(1);
            } finally {
                process.exitCode = exitBefore;
            }
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });
});
