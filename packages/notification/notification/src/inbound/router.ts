import type { Receiver } from "./types";
import { jsonResponse } from "./utils";

/**
 * A web-standard request handler: the shape returned by {@link createInboundRouter} and the
 * signature platforms like Cloudflare Workers, Deno, Bun and Node's `fetch` server expect.
 * @param request The inbound request.
 * @returns The response.
 */
export type FetchHandler = (request: Request) => Promise<Response>;

/**
 * Mounts several {@link Receiver}s behind a single fetch handler, dispatching by URL
 * path. Each key is matched against the request's path (by exact match or suffix, so a
 * mount base path does not need to be known ahead of time); unmatched paths get a `404`.
 *
 * The result is directly usable as a Cloudflare Workers / Deno / Bun `fetch` export, or via a
 * Node/Express/Hono web-request adapter.
 * @param routes A map of path (e.g. `"/webhooks/slack"`) to channel receiver.
 * @returns A fetch handler dispatching to the matching channel.
 */
export const createInboundRouter = (routes: Record<string, Receiver>): FetchHandler => {
    const entries = Object.entries(routes);

    return async (request: Request): Promise<Response> => {
        const { pathname } = new URL(request.url);
        const match = entries.find(([path]) => pathname === path || pathname.endsWith(path));

        if (match === undefined) {
            return jsonResponse({ error: "not_found" }, 404);
        }

        return match[1].handle(request);
    };
};
