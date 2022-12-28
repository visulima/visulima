import { createRequest, createResponse } from "node-mocks-http";
import {
    afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";

import TestUploader from "../__helpers__/handler/test-uploader";
import MockLogger from "../__helpers__/mock-logger";
import TestStorage from "../__helpers__/storage/test-storage";

describe("BaseHandler", () => {
    const storage = new TestStorage({ directory: "/files", logger: console });

    let uploader: TestUploader;

    beforeEach(async () => {
        uploader = new TestUploader({ storage });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("BaseHandler.compose registers correct HTTP methods as handlers", () => {
        const logger = new MockLogger();

        uploader = new TestUploader({ storage: new TestStorage({ logger, directory: "/files" }) });

        expect(logger.debug).toBeCalledWith("Registered handler: %s", "GET, OPTIONS");
    });

    it("BaseHandler.errorResponses setter updates internalErrorResponses correctly", () => {
        // eslint-disable-next-line radar/no-duplicate-string
        uploader.errorResponses = { FileNotFound: { message: "Not Found!", statusCode: 404 } };
        // @ts-expect-error
        expect(uploader.internalErrorResponses.FileNotFound).toEqual({ message: "Not Found!", statusCode: 404 });
    });

    it("BaseHandler.assembleErrors merges default and custom error responses correctly", () => {
        const errorObject = { message: "Not Found!", statusCode: 404 };

        // @ts-expect-error
        uploader.assembleErrors({ FileNotFound: errorObject });

        // @ts-expect-error
        expect(uploader.internalErrorResponses.FileNotFound).toEqual(errorObject);
        // @ts-expect-error
        expect(uploader.internalErrorResponses.InvalidRange).toEqual({
            message: "Invalid or missing content-range header",
            code: "InvalidRange",
            statusCode: 400,
        });
    });

    it("BaseHandler.handle calls correct handler based on request method", async () => {
        // eslint-disable-next-line compat/compat
        const getHandler = vi.fn(() => Promise.resolve({}));
        // @ts-expect-error
        uploader.registeredHandlers.set("GET", getHandler);

        const request = createRequest({ method: "GET" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(getHandler).toHaveBeenCalled();
    });

    it("BaseHandler.get returns list of uploaded files", async () => {
        uploader.list = vi.fn().mockResolvedValue([]);

        const request = createRequest({ method: "GET", url: "/uploads" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(uploader.list).toHaveBeenCalled();
        // eslint-disable-next-line no-underscore-dangle
        expect(response._getStatusCode()).toEqual(200);
        // eslint-disable-next-line no-underscore-dangle
        expect(response._getHeaders()).toEqual({});
    });

    it("should implement options()", async () => {
        const response = createResponse();
        const request = createRequest({ url: "/files" });

        const file = await uploader.options(request, response);

        expect(file.statusCode).toBe(204);
        expect(file.headers).toEqual({ "Access-Control-Allow-Methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT" });
    });

    it("should check if storage not ready", () => {
        uploader.storage.isReady = false;

        const response = createResponse();

        uploader.handle(createRequest({ method: "OPTIONS" }), response);

        expect(response.statusCode).toBe(503);

        uploader.storage.isReady = true;
    });

    it("should check http method", () => {
        const response = createResponse();

        uploader.handle(createRequest({ method: "PATCH" }), response);

        expect(response.statusCode).toBe(405);
    });

    it("should check if get list request", () => {
        const request = createRequest({ method: "GET", url: "/files" });
        const response = createResponse();

        uploader.handle(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should check if get id request", () => {
        const request = createRequest({ method: "GET", url: "/files/111" });
        let response = createResponse();

        uploader.handle(request, response);

        expect(response.statusCode).toBe(200);

        response = createResponse();

        uploader.get(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should check if get id request with query", () => {
        const request = createRequest({ method: "GET", url: "/files/111?name=foo" });
        const response = createResponse();

        uploader.handle(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should check if get id request with query and no name", () => {
        const request = createRequest({ method: "GET", url: "/files/111?name=" });
        const response = createResponse();

        uploader.handle(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should send Error", () => {
        uploader.responseType = "json";

        const response = createResponse();
        const sendSpy = vi.spyOn(uploader, "send");
        const error = new Error("Error Message");

        uploader.sendError(response, error);

        expect(sendSpy).toHaveBeenCalledWith(response, {
            statusCode: 500,
            body: {
                error: {
                    message: "Generic Upload Error",
                    code: "GenericUploadError",
                },
            },
            headers: undefined,
        });
    });
});
