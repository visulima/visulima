import { describe, expect, it, vi } from "vitest";

import { ActionsResolver } from "../../../../src/commands/update/ecosystems/actions/resolver";

const mockFetch = (responses: Record<string, unknown>): typeof fetch =>
    vi.fn(async (input: RequestInfo | URL) => {
        let url: string;

        if (typeof input === "string") {
            url = input;
        } else if (input instanceof URL) {
            url = input.href;
        } else {
            url = input.url;
        }

        const payload = responses[url];

        if (payload === undefined) {
            return new Response("not found", { status: 404 });
        }

        return Response.json(payload, { headers: { "content-type": "application/json" }, status: 200 });
    });

describe(ActionsResolver, () => {
    it("lists tags from the GitHub API and parses them through semver", async () => {
        expect.assertions(2);

        const fetchImpl = mockFetch({
            "https://api.github.com/repos/actions/checkout/tags?per_page=100": [
                { commit: { sha: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111" }, name: "v4.1.1" },
                { commit: { sha: "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222" }, name: "v4.0.0" },
                { commit: { sha: "cccc3333cccc3333cccc3333cccc3333cccc3333" }, name: "not-a-version" },
            ],
        });

        const resolver = new ActionsResolver({ apiBase: "https://api.github.com", fetch: fetchImpl, token: undefined });
        const { parsed, tags } = await resolver.listTags("actions", "checkout");

        expect(tags).toHaveLength(3);
        // not-a-version filtered out from parsed.
        expect(parsed).toHaveLength(2);
    });

    it("caches per repo so repeated lookups share one round-trip", async () => {
        expect.assertions(1);

        const fetchImpl = vi.fn(async () =>
            Response.json([{ commit: { sha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" }, name: "v1.0.0" }], { status: 200 }),
        ) as typeof fetch;
        const resolver = new ActionsResolver({ apiBase: "https://api.github.com", fetch: fetchImpl, token: undefined });

        await resolver.listTags("foo", "bar");
        await resolver.listTags("foo", "bar");

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("returns an empty result on non-OK responses", async () => {
        expect.assertions(1);

        const fetchImpl = vi.fn(async () => new Response("not authorized", { status: 401 })) as typeof fetch;
        const resolver = new ActionsResolver({ apiBase: "https://api.github.com", fetch: fetchImpl, token: undefined });
        const { tags } = await resolver.listTags("private", "repo");

        expect(tags).toHaveLength(0);
    });
});
