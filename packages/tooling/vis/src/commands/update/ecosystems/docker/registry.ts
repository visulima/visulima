import { parseLinkHeader } from "../link-header";
import type { ParsedTag } from "../semver-helpers";
import { parseTag } from "../semver-helpers";

/**
 * Docker-specific tag entry. Carries the registry-reported publish time
 * so the min-age gate can drop releases that are too fresh without
 * spending an extra round-trip. v2 registries that don't expose a
 * timestamp leave `lastUpdated` undefined and the gate skips silently.
 */
export interface DockerParsedTag extends ParsedTag {
    readonly lastUpdated: number | undefined;
}

interface RegistryTagListing {
    readonly raw: string[];
    readonly parsed: DockerParsedTag[];
}

export interface DockerRegistryOptions {
    /** Per-registry bearer tokens. Key is the registry host, value is the token. */
    readonly tokens?: Record<string, string>;
    /** Pluggable fetch for tests. */
    readonly fetch?: typeof fetch;
}

interface AuthInfo {
    readonly realm: string;
    readonly service: string;
    readonly scope: string;
}

/**
 * Multi-registry tag resolver. Talks the Docker Registry HTTP API v2:
 *   - `docker.io`: special-cased through Docker Hub's public API which
 *     paginates more pleasantly than the v2 manifest API
 *   - everything else: standard `GET /v2/<name>/tags/list`
 *
 * Anonymous reads are supported for public images. Tokens supplied via
 * `tokens[host]` (or `DOCKER_REGISTRY_TOKEN_<HOST>` env vars) override
 * the anonymous path.
 */
export class DockerRegistry {
    private readonly tokens: Record<string, string>;

    private readonly fetchImpl: typeof fetch;

    private readonly tagCache = new Map<string, Promise<RegistryTagListing>>();

    public constructor(options: DockerRegistryOptions = {}) {
        this.tokens = options.tokens ?? {};
        this.fetchImpl = options.fetch ?? fetch;
    }

    public async listTags(registry: string, namespace: string, image: string): Promise<RegistryTagListing> {
        const key = `${registry}/${namespace}/${image}`;
        const cached = this.tagCache.get(key);

        if (cached) {
            return cached;
        }

        const promise = registry === "docker.io" ? this.listDockerHubTags(namespace, image) : this.listV2Tags(registry, namespace, image);

        this.tagCache.set(key, promise);

        return promise;
    }

    /**
     * Docker Hub-specific endpoint that paginates 100 tags per call and
     * exposes `last_updated`. We cap at 5 pages (500 tags) — enough for
     * any popular image without burning rate limits.
     */
    private async listDockerHubTags(namespace: string, image: string): Promise<RegistryTagListing> {
        const empty: RegistryTagListing = { parsed: [], raw: [] };
        const tags: string[] = [];
        const lastUpdatedByTag = new Map<string, number>();
        let url: string | undefined = `https://hub.docker.com/v2/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(image)}/tags?page_size=100`;
        let pages = 0;

        while (url && pages < 5) {
            try {
                const response = await this.fetchImpl(url, { headers: { Accept: "application/json" } });

                if (!response.ok) {
                    break;
                }

                const json = (await response.json()) as { next?: string | null; results?: { last_updated?: string; name?: string }[] };

                if (Array.isArray(json.results)) {
                    for (const entry of json.results) {
                        if (typeof entry.name !== "string") {
                            continue;
                        }

                        tags.push(entry.name);

                        if (typeof entry.last_updated === "string") {
                            const epoch = Date.parse(entry.last_updated);

                            if (!Number.isNaN(epoch)) {
                                lastUpdatedByTag.set(entry.name, epoch);
                            }
                        }
                    }
                }

                url = typeof json.next === "string" ? json.next : undefined;
            } catch {
                break;
            }

            pages += 1;
        }

        if (tags.length === 0) {
            return empty;
        }

        const parsed = tags
            .map((tag) => {
                const base = parseTag(tag);

                if (!base) {
                    return undefined;
                }

                return { ...base, lastUpdated: lastUpdatedByTag.get(tag) };
            })
            .filter((tag): tag is DockerParsedTag => tag !== undefined);

        return { parsed, raw: tags };
    }

    /**
     * Standard v2 registry tag listing. Some registries (ghcr.io,
     * mcr.microsoft.com) require a bearer token even for public repos —
     * we honor the WWW-Authenticate challenge on a 401 and retry once.
     *
     * The registry HTTP API paginates via the `Link` header (RFC 5988)
     * — we walk up to 5 pages (500 tags) which is enough for any
     * realistic image without burning a session token's quota.
     */
    private async listV2Tags(registry: string, namespace: string, image: string): Promise<RegistryTagListing> {
        const empty: RegistryTagListing = { parsed: [], raw: [] };
        const repository = namespace === "library" ? image : `${namespace}/${image}`;
        const baseHeaders: Record<string, string> = { Accept: "application/json" };
        const explicit = this.tokens[registry] ?? process.env[`DOCKER_REGISTRY_TOKEN_${registry.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_")}`];

        if (explicit) {
            baseHeaders.Authorization = `Bearer ${explicit}`;
        }

        // The Link header carries a relative URL (`/v2/foo/tags/list?n=100&last=…`)
        // for cross-page navigation, so we need the base origin to
        // re-anchor it.
        const origin = `https://${registry}`;
        const tags: string[] = [];
        let nextUrl: string | undefined = `${origin}/v2/${repository}/tags/list?n=100`;
        let challengeHeaders: Record<string, string> = baseHeaders;
        let pages = 0;

        const buildResult = (): RegistryTagListing => {
            // v2 registries don't expose timestamps — leave `lastUpdated`
            // undefined and the min-age gate skips silently.
            const parsed: DockerParsedTag[] = [];

            for (const tag of tags) {
                const base = parseTag(tag);

                if (base) {
                    parsed.push({ ...base, lastUpdated: undefined });
                }
            }

            return { parsed, raw: tags };
        };

        while (nextUrl && pages < 5) {
            try {
                let response: Response = await this.fetchImpl(nextUrl, { headers: challengeHeaders });

                if (response.status === 401 && challengeHeaders === baseHeaders) {
                    const auth = parseAuthenticate(response.headers.get("www-authenticate"));

                    if (auth) {
                        const token = await this.fetchBearerToken(auth);

                        if (token) {
                            // Re-issue with the bearer token AND keep it
                            // for every subsequent page so we don't
                            // re-challenge once per page.
                            challengeHeaders = { ...baseHeaders, Authorization: `Bearer ${token}` };
                            response = await this.fetchImpl(nextUrl, { headers: challengeHeaders });
                        }
                    }
                }

                if (!response.ok) {
                    return pages === 0 ? empty : buildResult();
                }

                const json = (await response.json()) as { tags?: string[] };

                if (!Array.isArray(json.tags)) {
                    return pages === 0 ? empty : buildResult();
                }

                for (const tag of json.tags) {
                    if (typeof tag === "string") {
                        tags.push(tag);
                    }
                }

                const link = parseLinkHeader(response.headers.get("link"));

                if (link.next) {
                    // Registries may return either an absolute URL or a
                    // path-relative one — `URL` resolves both consistently.
                    nextUrl = new URL(link.next, origin).toString();
                } else {
                    nextUrl = undefined;
                }
            } catch {
                return pages === 0 ? empty : buildResult();
            }

            pages += 1;
        }

        if (tags.length === 0) {
            return empty;
        }

        return buildResult();
    }

    private async fetchBearerToken(auth: AuthInfo): Promise<string | undefined> {
        const params = new URLSearchParams({ scope: auth.scope, service: auth.service });
        const url = `${auth.realm}?${params.toString()}`;

        try {
            const response = await this.fetchImpl(url, { headers: { Accept: "application/json" } });

            if (!response.ok) {
                return undefined;
            }

            const json = (await response.json()) as { access_token?: string; token?: string };

            return json.token ?? json.access_token;
        } catch {
            return undefined;
        }
    }
}

/**
 * Parses the `Www-Authenticate: Bearer realm="…",service="…",scope="…"`
 * header sent by container registries. Returns `undefined` for the rare
 * registry that uses Basic auth (we don't try to prompt for creds — the
 * user can pass a bearer token instead).
 */
/**
 * Splits a `Www-Authenticate` parameter list (`k1="v1",k2="v2,with,commas",k3=v3`)
 * into `key,value` pairs, respecting quoted values that legitimately
 * contain commas (e.g. multi-action scopes like
 * `scope="repository:foo:pull,push"`). A naive `.split(",")` would shred
 * the scope and trigger silent auth failures.
 */
const splitAuthParams = (input: string): { key: string; value: string }[] => {
    const params: { key: string; value: string }[] = [];
    let index = 0;
    const length = input.length;

    while (index < length) {
        // Skip leading whitespace.
        while (index < length && /\s/.test(input[index] ?? "")) {
            index += 1;
        }

        const keyStart = index;

        while (index < length && input[index] !== "=" && input[index] !== ",") {
            index += 1;
        }

        const key = input.slice(keyStart, index).trim();

        if (input[index] !== "=") {
            // No value — skip past the next `,` if any.
            while (index < length && input[index] !== ",") {
                index += 1;
            }

            index += 1;
            continue;
        }

        index += 1; // consume `=`

        let value = "";

        if (input[index] === "\"") {
            index += 1;

            while (index < length && input[index] !== "\"") {
                if (input[index] === "\\" && index + 1 < length) {
                    value += input[index + 1] ?? "";
                    index += 2;
                    continue;
                }

                value += input[index] ?? "";
                index += 1;
            }

            index += 1; // consume closing `"`
        } else {
            while (index < length && input[index] !== ",") {
                value += input[index] ?? "";
                index += 1;
            }

            value = value.trim();
        }

        if (key.length > 0) {
            params.push({ key, value });
        }

        // Skip trailing whitespace and the separator comma.
        while (index < length && (/\s/.test(input[index] ?? "") || input[index] === ",")) {
            index += 1;
        }
    }

    return params;
};

const parseAuthenticate = (header: string | null | undefined): AuthInfo | undefined => {
    if (!header) {
        return undefined;
    }

    const match = /^Bearer\s+(.*)$/i.exec(header);

    if (!match) {
        return undefined;
    }

    const entries = new Map<string, string>();

    for (const { key, value } of splitAuthParams(match[1] ?? "")) {
        entries.set(key.toLowerCase(), value);
    }

    const realm = entries.get("realm");
    const service = entries.get("service");

    if (!realm) {
        return undefined;
    }

    return {
        realm,
        scope: entries.get("scope") ?? "",
        service: service ?? "",
    };
};
