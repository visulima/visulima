// Copied from __tests__/storage/gcs/gcs-fake.test.ts so other suites can share it; unlike the original it
// refuses object metadata with non-string values, as GCS does.

type Stored = { body: Uint8Array; contentType: string; generation: number; updated: Date };

/**
 * In-memory GCS JSON API at https://gcs.test, bucket "uploads", installed as gaxios' fetch.
 * `override` answers a request before the fake does, to inject failures.
 */
export const createGcsFake = () => {
    const objects = new Map<string, Stored>();
    const sessions = new Map<string, { contentType: string; name: string; received: Uint8Array; size: number }>();
    const requests: { method: string; url: string }[] = [];
    const state: { generation: number; override?: (method: string, url: URL) => Response | undefined; pageSize?: number } = { generation: 0 };

    const json = (data: unknown, init?: ResponseInit): Response => Response.json(data, init);
    const missing = (): Response => json({ error: { code: 404, message: "No such object" } }, { status: 404 });

    const readBody = async (body: unknown): Promise<Uint8Array> => {
        if (body === undefined || body === null) {
            return new Uint8Array(0);
        }

        if (typeof body === "string") {
            return new TextEncoder().encode(body);
        }

        if (body instanceof Uint8Array) {
            return body;
        }

        const chunks: Buffer[] = [];

        for await (const chunk of body as AsyncIterable<Uint8Array>) {
            chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    };

    const put = (name: string, body: Uint8Array, contentType: string): Stored => {
        state.generation += 1;

        const stored = { body, contentType, generation: state.generation, updated: new Date() };

        objects.set(name, stored);

        return stored;
    };

    const resource = (name: string, stored: Stored) => {
        return {
            contentType: stored.contentType,
            etag: `e${String(stored.generation)}`,
            generation: String(stored.generation),
            mediaLink: `https://gcs.test/download/storage/v1/b/uploads/o/${encodeURIComponent(name)}?alt=media`,
            name,
            size: String(stored.body.byteLength),
            timeCreated: stored.updated.toISOString(),
            updated: stored.updated.toISOString(),
        };
    };

    const fetch = async (input: string, init: { body?: unknown; headers?: Headers; method?: string } = {}): Promise<Response> => {
        const url = new URL(input);
        const method = init.method ?? "GET";
        const headers = new Headers(init.headers);

        requests.push({ method, url: url.href });

        const overridden = state.override?.(method, url);

        if (overridden) {
            return overridden;
        }

        const { pathname, searchParams } = url;

        if (pathname.startsWith("/session/")) {
            const session = sessions.get(pathname);

            if (!session) {
                return missing();
            }

            if (method === "DELETE") {
                sessions.delete(pathname);

                return new Response(null, { status: 499 });
            }

            const chunk = await readBody(init.body);
            const range = /bytes (\d+)-\d+\//u.exec(headers.get("content-range") ?? "");

            if (range && Number(range[1]) === session.received.byteLength) {
                session.received = Buffer.concat([session.received, chunk]);
            }

            if (session.received.byteLength >= session.size) {
                sessions.delete(pathname);

                return json(resource(session.name, put(session.name, session.received, session.contentType)));
            }

            return new Response(null, {
                headers: session.received.byteLength > 0 ? { range: `bytes=0-${String(session.received.byteLength - 1)}` } : {},
                status: 308,
            });
        }

        if (pathname === "/upload/storage/v1/b/uploads/o" && method === "POST") {
            const name = searchParams.get("name") as string;

            if (searchParams.get("uploadType") === "resumable") {
                const { metadata = {} } = JSON.parse(new TextDecoder().decode(await readBody(init.body)) || "{}") as { metadata?: Record<string, unknown> };

                // Like GCS, object metadata takes string values only.
                if (Object.values(metadata).some((value) => typeof value !== "string")) {
                    return json({ error: { code: 400, message: "Invalid metadata value" } }, { status: 400 });
                }

                const location = `/session/${String(sessions.size + 1)}-${encodeURIComponent(name)}`;

                sessions.set(location, {
                    contentType: headers.get("x-upload-content-type") ?? "application/octet-stream",
                    name,
                    received: new Uint8Array(0),
                    size: Number(headers.get("x-upload-content-length")),
                });

                return new Response(null, { headers: { location: `https://gcs.test${location}`, "x-goog-upload-status": "active" } });
            }

            const ifGenerationMatch = searchParams.get("ifGenerationMatch");

            if (ifGenerationMatch !== null && String(objects.get(name)?.generation) !== ifGenerationMatch) {
                return json({ error: { code: 412 } }, { status: 412 });
            }

            return json(resource(name, put(name, await readBody(init.body), "application/json")));
        }

        const prefix = "/storage/v1/b/uploads/o";

        if (!pathname.startsWith(prefix)) {
            return json({ name: "uploads" });
        }

        if (pathname === prefix) {
            const delimiter = searchParams.get("delimiter");
            const namePrefix = searchParams.get("prefix") ?? "";
            const max = Math.min(Number(searchParams.get("maxResults") ?? 1000), state.pageSize ?? 1000);
            const offset = Number(searchParams.get("pageToken") ?? 0);
            const prefixes = new Set<string>();
            const names = [...objects.keys()]
                .filter((name) => name.startsWith(namePrefix))
                .toSorted()
                .filter((name) => {
                    const rest = name.slice(namePrefix.length);
                    const index = delimiter ? rest.indexOf(delimiter) : -1;

                    if (index !== -1) {
                        prefixes.add(namePrefix + rest.slice(0, index + (delimiter as string).length));

                        return false;
                    }

                    return true;
                });
            const page = names.slice(offset, offset + max);

            return json({
                items: page.map((name) => resource(name, objects.get(name) as Stored)),
                ...(offset + max < names.length && { nextPageToken: String(offset + max) }),
                ...(prefixes.size > 0 && { prefixes: [...prefixes] }),
            });
        }

        const rewrite = /^\/([^/]+)\/rewriteTo\/b\/([^/]+)\/o\/([^/]+)$/u.exec(pathname.slice(prefix.length));

        if (rewrite && method === "POST") {
            const source = objects.get(decodeURIComponent(rewrite[1] as string));

            if (!source) {
                return missing();
            }

            // The first call answers with a token, so the adapter has to keep rewriting.
            const token = await readBody(init.body);

            if (token.byteLength === 0) {
                return json({ done: false, rewriteToken: "t1", totalBytesRewritten: 0 });
            }

            const destination = decodeURIComponent(rewrite[3] as string);

            return json({ done: true, resource: resource(destination, put(destination, source.body, source.contentType)) });
        }

        const segment = pathname.slice(prefix.length + 1);

        // The object name is one path segment: an unencoded "/" addresses something else.
        if (segment.includes("/")) {
            return missing();
        }

        const name = decodeURIComponent(segment);
        const stored = objects.get(name);

        if (method === "DELETE") {
            return objects.delete(name) ? new Response(null, { status: 204 }) : missing();
        }

        if (!stored) {
            return missing();
        }

        if (method === "HEAD") {
            return new Response(null, { status: 200 });
        }

        if (searchParams.get("alt") === "media") {
            return new Response(stored.body, { headers: { "content-type": stored.contentType, "x-goog-generation": String(stored.generation) } });
        }

        return json(resource(name, stored));
    };

    return { fetch, objects, requests, sessions, state };
};
