import { rm } from "node:fs/promises";

import { createRequest, createResponse } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import BaseHandlerNode from "../../../src/handler/base/base-handler-node";
import DiskStorage from "../../../src/storage/local/disk-storage";
import type { File } from "../../../src/storage/utils/file";
import { storageOptions } from "../../__helpers__/config";

class ListUploader extends BaseHandlerNode<File> {
    protected compose(): void {
        this.registeredHandlers.set("GET", this.get.bind(this));
    }
}

const makeFile = (id: string): File =>
    ({
        bytesWritten: 10,
        contentType: "application/octet-stream",
        createdAt: new Date().toISOString(),
        id,
        metadata: {},
        name: `${id}.dat`,
        originalName: `${id}.dat`,
        size: 10,
        status: "completed",
    }) as unknown as File;

describe("baseHandlerNode.list pagination", () => {
    let directory: string;
    let storage: DiskStorage;
    let uploader: ListUploader;

    beforeAll(async () => {
        directory = temporaryDirectory();
        storage = new DiskStorage({ ...storageOptions, directory });
        uploader = new ListUploader({ storage });
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a plain array when no pagination params are provided", async () => {
        expect.assertions(2);

        const files = [makeFile("a"), makeFile("b"), makeFile("c")];

        vi.spyOn(storage, "list").mockResolvedValue(files);

        const request = createRequest({ method: "GET", url: "/files" });
        const response = createResponse();

        const result = await uploader.list(request, response);

        // A plain array (not a Paginator, which would carry a `currentPage`).
        expect(result.data).not.toHaveProperty("currentPage");
        expect(result.data).toStrictEqual(files);
    });

    it("returns a paginator only when both page and limit params are present", async () => {
        expect.assertions(2);

        const files = [makeFile("a"), makeFile("b"), makeFile("c")];

        vi.spyOn(storage, "list").mockResolvedValue(files);

        const request = createRequest({ method: "GET", url: "/files?page=1&limit=2" });
        const response = createResponse();

        const result = await uploader.list(request, response);

        // A Paginator carries pagination metadata derived from the query params.
        expect(result.data).toHaveProperty("currentPage", 1);
        expect(result.data).toHaveProperty("perPage", 2);
    });
});
