import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";

import { join } from "@visulima/path";
import type { OpenAPIV3 } from "openapi-types";

import yamlTransformer from "../../../../serializers/transformer/yaml";
import type { SwaggerHandlerOptions } from "../../../../swagger/api/swagger-handler";
import { buildSpec } from "../../../../swagger/api/swagger-handler";

const yamlAcceptRegex = /yaml|yml/u;

interface CachedSpec {
    etag: string;
    mtimeMs: number;
    spec: OpenAPIV3.Document;
}

/**
 * Create a Next.js App Router (fetch API) route handler that serves the OpenAPI
 * specification.
 *
 * Drop it into `app/api/docs/route.ts`:
 *
 * ```ts
 * import { swaggerRouteHandler } from "@visulima/api-platform/next";
 *
 * export const GET = swaggerRouteHandler();
 * ```
 *
 * Unlike the pages-router `swaggerHandler`, this returns a Web standard
 * `Response`, supports `Accept`-based JSON/YAML negotiation, and emits an `ETag`
 * with `304 Not Modified` handling. The assembled spec is memoized on the source
 * file's mtime.
 */
const swaggerRouteHandler = <M extends string, PrismaClient>(
    options: Partial<SwaggerHandlerOptions<M, PrismaClient>> = {},
): (request: Request) => Promise<Response> => {
    const {
        allowedMediaTypes = {
            "application/json": true,
        },
        crud,
        specs,
        swaggerFilePath,
    } = options;

    let cache: CachedSpec | undefined;

    return async (request: Request): Promise<Response> => {
        const swaggerPath = join(process.cwd(), swaggerFilePath ?? "swagger/swagger.json");

        if (!existsSync(swaggerPath)) {
            throw new Error(`Swagger file not found at "${swaggerPath}".`);
        }

        const { mtimeMs } = statSync(swaggerPath);

        if (cache?.mtimeMs !== mtimeMs) {
            const fileContents = readFileSync(swaggerPath, "utf8");
            const spec = await buildSpec(fileContents, allowedMediaTypes, crud, specs);
            // sha1 here is a non-cryptographic content fingerprint for the ETag.
            // eslint-disable-next-line sonarjs/hashing -- ETag fingerprint, not a security-sensitive hash
            const etag = `"${createHash("sha1").update(JSON.stringify(spec)).digest("base64")}"`;

            cache = { etag, mtimeMs, spec };
        }

        const { etag, spec } = cache;

        if (request.headers.get("if-none-match") === etag) {
            return new Response(undefined, { headers: { ETag: etag }, status: 304 });
        }

        const accept = request.headers.get("accept");

        if (typeof accept === "string" && yamlAcceptRegex.test(accept)) {
            const body = yamlTransformer(spec);

            return new Response(typeof body === "string" ? body : new Uint8Array(body), {
                headers: { "Content-Type": accept, ETag: etag },
                status: 200,
            });
        }

        // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer must be null to use the third indent argument
        return new Response(JSON.stringify(spec, null, 2), {
            headers: { "Content-Type": "application/json", ETag: etag },
            status: 200,
        });
    };
};

export default swaggerRouteHandler;
