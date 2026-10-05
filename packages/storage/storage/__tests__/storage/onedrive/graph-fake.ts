import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import { Client } from "@microsoft/microsoft-graph-client";

type Item = { body: Uint8Array; id: string; mimeType: string; modified: Date };
type Session = { chunks: Uint8Array[]; mimeType: string; path: string; received: number };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
    Response.json(body, { headers: { "content-type": "application/json", ...headers }, status });

const notFound = (): Response => json({ error: { code: "itemNotFound", message: "The resource could not be found." } }, 404);

const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const bytesOf = (body: unknown): Uint8Array => {
    if (typeof body === "string") {
        return new TextEncoder().encode(body);
    }

    return body ? new Uint8Array(body as ArrayBuffer) : new Uint8Array();
};

/**
 * In-memory Microsoft Graph drive. Items are keyed by their drive-relative path ("uploads/a.txt");
 * folders exist implicitly. `client` is a real Graph SDK client whose transport is this fake, and
 * `fetch` answers the requests the adapter sends outside the SDK (upload sessions, copy monitors).
 * `override` answers a request before the fake does, to inject failures.
 */
export const createGraph = (pageSize = 2) => {
    const items = new Map<string, Item>();
    const sessions = new Map<string, Session>();
    const monitors = new Map<string, string>();
    const requests: string[] = [];
    const state: { override?: (method: string, url: URL) => Response | undefined } = {};
    let counter = 0;

    const toDriveItem = (path: string, item: Item): Record<string, unknown> => {
        const folder = folderOf(path);

        return {
            "@microsoft.graph.downloadUrl": `https://download.test/${item.id}`,
            eTag: `"${item.id}"`,
            file: { mimeType: item.mimeType },
            id: item.id,
            lastModifiedDateTime: item.modified.toISOString(),
            name: path.slice(path.lastIndexOf("/") + 1),
            parentReference: { path: folder ? `/drive/root:/${folder}` : "/drive/root:" },
            size: item.body.byteLength,
            webUrl: `https://drive.test/${path}`,
        };
    };

    const put = (path: string, body: Uint8Array, mimeType: string): Item => {
        counter += 1;

        const item = { body, id: `item${String(counter)}`, mimeType, modified: new Date() };

        items.set(path, item);

        return item;
    };

    /** "/drive/root:/a/b" → "a/b" */
    const parentPath = (reference: string): string => decodeURIComponent(reference.replace(/^\/drive\/root:\/?/u, ""));

    const children = (folder: string, url: URL): Response => {
        const entries = new Map<string, Record<string, unknown>>();
        const prefix = folder ? `${folder}/` : "";

        for (const [path, item] of items) {
            if (path.startsWith(prefix)) {
                const rest = path.slice(prefix.length);
                const slash = rest.indexOf("/");

                entries.set(slash === -1 ? rest : `${rest.slice(0, slash)}/`, slash === -1 ? toDriveItem(path, item) : { folder: {}, id: rest.slice(0, slash), name: rest.slice(0, slash) });
            }
        }

        const all = [...entries.values()];
        const top = Math.min(Number(url.searchParams.get("$top") ?? pageSize), pageSize);
        const skip = Number(url.searchParams.get("$skiptoken") ?? 0);
        const next = new URL(url);

        next.searchParams.set("$skiptoken", String(skip + top));

        return json({ value: all.slice(skip, skip + top), ...(skip + top < all.length && { "@odata.nextLink": next.href }) });
    };

    const graph = async (method: string, url: URL, body: unknown): Promise<Response> => {
        requests.push(`${method} ${decodeURIComponent(url.pathname)}`);

        const overridden = state.override?.(method, url);

        if (overridden) {
            return overridden;
        }

        const rootIndex = url.pathname.indexOf("/root");

        if (rootIndex === -1) {
            return notFound();
        }

        let rest = url.pathname.slice(rootIndex + "/root".length);
        let path = "";
        let action: string | undefined;

        if (rest.startsWith(":/")) {
            rest = rest.slice(2);

            const colon = rest.indexOf(":/");

            path = decodeURIComponent(colon === -1 ? rest : rest.slice(0, colon));
            action = colon === -1 ? undefined : rest.slice(colon + 2);
        } else {
            action = rest.slice(1) || undefined;
        }

        const item = items.get(path);
        const payload = typeof body === "string" ? (JSON.parse(body) as Record<string, any>) : {};

        switch (action) {
            case "children": {
                return children(path, url);
            }
            case "content": {
                if (method === "PUT") {
                    return json(toDriveItem(path, put(path, bytesOf(body), "application/octet-stream")), 201);
                }

                return item ? new Response(item.body as BodyInit) : notFound();
            }
            case "copy": {
                if (!item) {
                    return notFound();
                }

                const destination = [parentPath(payload.parentReference.path), payload.name].filter(Boolean).join("/");

                const { id } = put(destination, item.body, item.mimeType);

                monitors.set(`m${id}`, id);

                return new Response(null, { headers: { Location: `https://monitor.test/m${id}` }, status: 202 });
            }
            case "createLink": {
                return json({ link: { webUrl: `https://share.test/${path}` } });
            }
            case "createUploadSession": {
                counter += 1;
                sessions.set(`s${String(counter)}`, { chunks: [], mimeType: payload.item?.file?.mimeType ?? "application/octet-stream", path, received: 0 });

                return json({ expirationDateTime: new Date(Date.now() + 60_000).toISOString(), uploadUrl: `https://upload.test/s${String(counter)}` });
            }
            case undefined: {
                if (!item) {
                    return notFound();
                }

                if (method === "DELETE") {
                    items.delete(path);

                    return new Response(null, { status: 204 });
                }

                if (method === "PATCH") {
                    const destination = [parentPath(payload.parentReference.path), payload.name].filter(Boolean).join("/");

                    items.delete(path);
                    items.set(destination, item);

                    return json(toDriveItem(destination, item));
                }

                return json(toDriveItem(path, item));
            }
            default: {
                return notFound();
            }
        }
    };

    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);

        requests.push(`${request.method} ${url.href}`);

        if (url.host === "monitor.test") {
            const resourceId = monitors.get(url.pathname.slice(1));

            return resourceId ? json({ resourceId, status: "completed" }) : json({ error: { message: "copy failed" }, status: "failed" });
        }

        const overridden = state.override?.(request.method, url);

        if (overridden) {
            return overridden;
        }

        const session = sessions.get(url.pathname.slice(1));

        if (!session) {
            return notFound();
        }

        const [, start, end, total] = (/^bytes (\d+)-(\d+)\/(\d+)$/u.exec(request.headers.get("content-range") ?? "") ?? []).map(Number);

        if (start !== session.received) {
            return json({ error: { code: "invalidRange" } }, 416);
        }

        session.chunks.push(new Uint8Array(await request.arrayBuffer()));
        session.received = (end as number) + 1;

        if (session.received < (total as number)) {
            return json({ nextExpectedRanges: [`${String(session.received)}-`] }, 202);
        }

        sessions.delete(url.pathname.slice(1));

        return json(toDriveItem(session.path, put(session.path, Buffer.concat(session.chunks), session.mimeType)), 201);
    };

    const client: GraphClient = Client.initWithMiddleware({
        middleware: {
            execute: async (context) => {
                const url = new URL(typeof context.request === "string" ? context.request : context.request.url);

                context.response = await graph(context.options?.method ?? "GET", url, context.options?.body);
            },
        },
    });

    return { client, fetch, items, put, requests, sessions, state };
};
