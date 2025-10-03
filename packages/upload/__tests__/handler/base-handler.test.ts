import { createRequest, createResponse } from "node-mocks-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TestUploader from "../__helpers__/handler/test-uploader";
import MockLogger from "../__helpers__/mock-logger";
import TestStorage from "../__helpers__/storage/test-storage";

describe("baseHandler", () => {
    const storage = new TestStorage({ directory: "/files", logger: console });

    let uploader: TestUploader;

    beforeEach(async () => {
        uploader = new TestUploader({ storage });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("baseHandler.compose registers correct HTTP methods as handlers", () => {
        expect.assertions(2);

        const logger = new MockLogger();

        uploader = new TestUploader({ storage: new TestStorage({ directory: "/files", logger }) });

        expect(logger.debug).toHaveBeenCalledTimes(2);
        expect(logger.debug).toHaveBeenCalledWithExactlyOnceWith("Registered handler: %s", "GET, OPTIONS");
    });

    it("baseHandler.errorResponses setter updates internalErrorResponses correctly", () => {
        expect.assertions(1);

        uploader.errorResponses = { FileNotFound: { message: "Not Found!", statusCode: 404 } };

        expect(uploader.internalErrorResponses.FileNotFound).toEqual({ message: "Not Found!", statusCode: 404 });
    });

    it("baseHandler.assembleErrors merges default and custom error responses correctly", () => {
        expect.assertions(2);

        const errorObject = { message: "Not Found!", statusCode: 404 };

        uploader.assembleErrors({ FileNotFound: errorObject });

        expect(uploader.internalErrorResponses.FileNotFound).toEqual(errorObject);
        expect(uploader.internalErrorResponses.InvalidRange).toEqual({
            code: "InvalidRange",
            message: "Invalid or missing content-range header",
            statusCode: 400,
        });
    });

    it("baseHandler.handle calls correct handler based on request method", async () => {
        // eslint-disable-next-line compat/compat
        const getHandler = vi.fn(() => Promise.resolve({}));

        uploader.registeredHandlers.set("GET", getHandler);

        const request = createRequest({ method: "GET" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(getHandler).toHaveBeenCalledTimes(1);
        expect(getHandler).toHaveBeenCalledWithExactlyOnceWith(request, response);
    });

    it("baseHandler.get returns list of uploaded files", async () => {
        vi.spyOn(uploader, "list").mockImplementation().mockResolvedValue([]);

        const request = createRequest({ method: "GET", url: "/uploads" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(uploader.list).toHaveBeenCalledTimes(1);
        expect(uploader.list).toHaveBeenCalledWithExactlyOnceWith(request, response);
        // eslint-disable-next-line no-underscore-dangle
        expect(response._getStatusCode()).toBe(200);
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

        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledWithExactlyOnceWith(response, {
            body: {
                error: {
                    code: "GenericUploadError",
                    message: "Generic Upload Error",
                },
            },
            headers: undefined,
            statusCode: 500,
        });
    });
});
