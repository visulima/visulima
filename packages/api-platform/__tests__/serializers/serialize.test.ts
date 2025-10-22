import type { IncomingMessage, ServerResponse } from "node:http";

import { describe, expect, it, vi } from "vitest";

import serialize from "../../src/serializers/serialize";

describe(serialize, () => {
    it("should correctly sets the Content-Type header in the response when a serializer is found for the given type in the accept header", () => {
        expect.assertions(1);

        const request = {} as IncomingMessage;

        request.headers = { accept: "application/json" };

        const response = {
            getHeader: () => {},
            setHeader: () => {},
        } as ServerResponse;

        vi.spyOn(response, "setHeader").mockImplementation();
        vi.spyOn(response, "getHeader").mockImplementation();

        const data = { test: "data" };
        const options = { defaultContentType: "application/json" };

        const serializers = [
            {
                regex: /json/u,
                serializer: (d: any) => JSON.stringify(d),
            },
        ];

        serialize(serializers, request, response, data, options);

        expect(response.setHeader).toHaveBeenNthCalledWith(1, "Content-Type", "application/json");
    });

    it.each([
        { accept: "application/x-yaml", data: { test: "data" }, expected: "test: data\n" },
        { accept: "application/x-yml", data: { test: "data" }, expected: "test: data\n" },
        {
            accept: "application/x-xml",
            data: { test: "data" },
            expected: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Undefined>\n  <test>data</test>\n</Undefined>",
        },
    ])("should correctly serializes the data using the correct serializer when a serializer is found for the given type in the accept header", (test) => {
        expect.assertions(1);

        const { accept, data, expected } = test;

        const request = {} as IncomingMessage;

        request.headers = { accept };

        const response = {
            getHeader: () => {},
            setHeader: () => {},
        } as ServerResponse;

        vi.spyOn(response, "setHeader").mockImplementation();
        vi.spyOn(response, "getHeader").mockImplementation();

        const result = serialize([], request, response, data, { defaultContentType: "application/json" });

        expect(result).toStrictEqual(expected);
    });

    it("should returns the original data unmodified when the Content-Type header is already set in the response", () => {
        expect.assertions(2);

        const request = {} as IncomingMessage;

        request.headers = { accept: "application/json" };

        const response = {
            getHeader: () => {},
            setHeader: () => {},
        } as ServerResponse;

        vi.spyOn(response, "getHeader").mockImplementation().mockReturnValue("application/json");
        vi.spyOn(response, "setHeader").mockImplementation();

        const data = { test: "data" };
        const options = { defaultContentType: "application/json" };

        const serializers = [
            {
                regex: /json/u,
                serializer: (d: any) => JSON.stringify(d),
            },
        ];

        const result = serialize(serializers, request, response, data, options);

        expect(response.setHeader).not.toHaveBeenCalled();
        expect(result).toStrictEqual(data);
    });

    it("should sets the Content-Type header in the response to options.defaultContentType and serializes the data using the correct serializer when no matching serializer is found for the given types in the accept header", () => {
        expect.assertions(2);

        const request = {} as IncomingMessage;

        request.headers = { accept: "application/text" };

        const response = {
            getHeader: () => {},
            setHeader: () => {},
        } as ServerResponse;

        vi.spyOn(response, "setHeader").mockImplementation();
        vi.spyOn(response, "getHeader").mockImplementation();

        const data = { test: "data" };
        const options = { defaultContentType: "application/json" };

        const serializers = [
            {
                regex: /json/u,
                serializer: (d: any) => JSON.stringify(d),
            },
        ];

        const result = serialize(serializers, request, response, data, options);

        expect(response.setHeader).toHaveBeenCalledExactlyOnceWith("Content-Type", "application/json");
        expect(result).toStrictEqual(JSON.stringify(data));
    });
});
