import type { APIEvent } from "@solidjs/start/server";
import { Hono } from "hono";
import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Multipart, Rest, Tus } from "../../../src/handler/http/fetch";
import { createStorageHandler } from "../../../src/handler/http/hono";
import { createHandler } from "../../../src/handler/http/nextjs";
import { createSolidStartHandler } from "../../../src/handler/http/solid-start";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import type { Send } from "../../__helpers__/handler/flows";
import { MULTIPART_FLOW_ASSERTIONS, multipartFlow, REST_FLOW_ASSERTIONS, restFlow, TUS_FLOW_ASSERTIONS, tusFlow } from "../../__helpers__/handler/flows";

type HandlerType = "multipart" | "rest" | "tus";

const ORIGIN = "http://localhost";

const toRequest = (path: string, init?: RequestInit): Request => new Request(`${ORIGIN}${path}`, init);

/** Builds a `Send` for each runtime adapter, with the handler mounted at `/files`. */
const adapters: Record<string, (type: HandlerType, storage: MemoryStorage) => Send> = {
    fetch: (type, storage) => {
        const handler = { multipart: () => new Multipart({ storage }), rest: () => new Rest({ storage }), tus: () => new Tus({ storage }) }[type]();

        return async (path, init) => handler.fetch(toRequest(path, init));
    },
    hono: (type, storage) => {
        const app = new Hono();

        createStorageHandler(app, { path: "/files", storage, type });

        return async (path, init) => app.request(toRequest(path, init));
    },
    nextjs: (type, storage) => {
        const handler = createHandler({ storage, type });

        return async (path, init) => handler(toRequest(path, init) as NextRequest);
    },
    "solid-start": (type, storage) => {
        const handler = createSolidStartHandler({ storage, type });

        return async (path, init) => handler({ request: toRequest(path, init) } as APIEvent);
    },
};

describe.each(Object.entries(adapters))("%s adapter", (_name, mount) => {
    it("should run the REST flow end to end", async () => {
        expect.assertions(REST_FLOW_ASSERTIONS);

        await restFlow(mount("rest", new MemoryStorage()), "/files");
    });

    it("should run the TUS flow end to end", async () => {
        expect.assertions(TUS_FLOW_ASSERTIONS);

        await tusFlow(mount("tus", new MemoryStorage()), "/files");
    });

    it("should run the multipart flow end to end", async () => {
        expect.assertions(MULTIPART_FLOW_ASSERTIONS);

        await multipartFlow(mount("multipart", new MemoryStorage()), "/files");
    });
});

describe("framework adapter factories", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should reject an unknown handler type", () => {
        expect.assertions(3);

        const storage = new MemoryStorage();
        const type = "graphql" as HandlerType;

        expect(() => createStorageHandler(new Hono(), { path: "/files", storage, type })).toThrow("Unknown handler type: graphql");
        expect(() => createHandler({ storage, type })).toThrow("Unknown handler type: graphql");
        expect(() => createSolidStartHandler({ storage, type })).toThrow("Unknown handler type: graphql");
    });

    it("should only route the mount path and below through Hono", async () => {
        expect.assertions(2);

        const app = new Hono();

        createStorageHandler(app, { path: "/files", storage: new MemoryStorage(), type: "rest" });

        const outside = await app.request("/other");
        const sibling = await app.request("/files-other", { method: "OPTIONS" });

        expect(outside.status).toBe(404);
        expect(sibling.status).toBe(404);
    });

    it.each([
        ["hono", (): Send => adapters.hono("rest", new MemoryStorage())],
        ["nextjs", (): Send => adapters.nextjs("rest", new MemoryStorage())],
        ["solid-start", (): Send => adapters["solid-start"]("rest", new MemoryStorage())],
    ])("should turn a thrown %s handler error into a JSON error response", async (_name, build) => {
        expect.assertions(4);

        const send = build();
        const spy = vi.spyOn(Rest.prototype, "fetch");

        spy.mockRejectedValueOnce(Object.assign(new Error("teapot"), { statusCode: 418 }));

        const withStatusCode = await send("/files", { method: "GET" });

        expect(withStatusCode.status).toBe(418);
        await expect(withStatusCode.json()).resolves.toStrictEqual({ error: "teapot" });

        spy.mockRejectedValueOnce({ status: "503" });

        const withStatusString = await send("/files", { method: "GET" });

        expect(withStatusString.status).toBe(503);
        await expect(withStatusString.json()).resolves.toStrictEqual({ error: "Request failed" });
    });

    it("should answer 405 for a method the handler does not serve", async () => {
        expect.assertions(2);

        const send = adapters.nextjs("multipart", new MemoryStorage());

        const patch = await send("/files/abc", { body: "x", method: "PATCH" });
        const head = await adapters["solid-start"]("multipart", new MemoryStorage())("/files/abc", { method: "HEAD" });

        expect(patch.status).toBe(405);
        expect(head.status).toBe(405);
    });
});
