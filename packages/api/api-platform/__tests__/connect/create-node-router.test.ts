import { NodeRouter } from "@visulima/connect";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import createNodeRouter from "../../src/connect/create-node-router";

const CSV_REGEX = /csv/u;

describe("connect/create-node-router", () => {
    it("should return a NodeRouter instance with default middlewares", () => {
        expect.assertions(1);

        const router = createNodeRouter();

        expect(router).toBeInstanceOf(NodeRouter);
    });

    it("should normalize headers and serialize responses through the wired middlewares", async () => {
        expect.assertions(2);

        const router = createNodeRouter({
            middlewares: {
                serializers: {
                    serializers: [
                        {
                            regex: CSV_REGEX,
                            serializer: (data: unknown) => `csv:${JSON.stringify(data)}`,
                        },
                    ],
                },
            },
        });

        router.get((_request, response) => {
            (response as typeof response & { send: (data: unknown) => void }).send({ hello: "world" });
        });

        const { req, res } = createMocks({
            headers: { ACCEPT: "text/csv" },
            method: "GET",
        });

        await router.run(req, res);

        expect(req.headers.accept).toBe("text/csv");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("csv:{\"hello\":\"world\"}");
    });

    it("should accept custom error handlers and showTrace options", () => {
        expect.assertions(1);

        const router = createNodeRouter({
            errorHandlers: [],
            showTrace: true,
        });

        expect(router).toBeInstanceOf(NodeRouter);
    });
});
