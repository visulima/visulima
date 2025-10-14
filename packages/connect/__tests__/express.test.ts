import type { IncomingMessage, ServerResponse } from "node:http";

import { describe, expect, it } from "vitest";

import type { ExpressRequestHandler } from "../src";
import { expressWrapper, NodeRouter } from "../src";

describe(expressWrapper, () => {
    const request = { url: "/" } as IncomingMessage;
    const response = {} as ServerResponse;

    it("basic", async () => {
        expect.assertions(3);

        const context = new NodeRouter();

        const midd: ExpressRequestHandler<IncomingMessage, ServerResponse> = (reqq, ress, next) => {
            expect(reqq, "called with req").toStrictEqual(request);
            expect(ress, "called with res").toStrictEqual(response);

            next();
        };

        context.use(expressWrapper(midd)).use(() => "ok");

        await expect(context.run(request, response), "returned the last value").resolves.toBe("ok");
    });

    it("next()", async () => {
        expect.assertions(2);

        const context = new NodeRouter();

        const midd: ExpressRequestHandler<IncomingMessage, ServerResponse> = (_reqq, _ress, next) => {
            next();
        };

        context.use(expressWrapper(midd)).use(async () => "ok");

        await expect(context.run(request, response), "returned the last value").resolves.toBe("ok");

        const context2 = new NodeRouter();
        const error = new Error("💥");

        context2.use(expressWrapper(midd)).use(async () => {
            throw error;
        });

        await expect(() => context2.run(request, response), "throws async error").rejects.toThrow(error);
    });

    it("next(err)", async () => {
        expect.assertions(1);

        const error = new Error("💥");
        const context = new NodeRouter();

        const midd: ExpressRequestHandler<IncomingMessage, ServerResponse> = (_reqq, _ress, next) => {
            next(error);
        };

        context.use(expressWrapper(midd)).use(async () => "ok");

        await expect(() => context.run(request, response), "throws error called with next(err)").rejects.toThrow(error);
    });
});
