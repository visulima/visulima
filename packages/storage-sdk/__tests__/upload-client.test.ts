import { describe, expect, it, vi } from "vitest";
import { UploadClient } from "../src/upload-client";

// Mock the TusClient and MultipartClient
vi.mock("../src/tus-client", () => ({
    TusClient: vi.fn().mockImplementation(() => ({
        createUpload: vi.fn(),
        resumeUpload: vi.fn(),
        getServerCapabilities: vi.fn(),
    })),
}));

vi.mock("../src/multipart-client", () => ({
    MultipartClient: vi.fn().mockImplementation(() => ({
        upload: vi.fn(),
        delete: vi.fn(),
        getMetadata: vi.fn(),
    })),
}));

describe("UploadClient", () => {
    let client: UploadClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new UploadClient({
            baseUrl: "https://api.example.com",
        });
    });

    describe("constructor", () => {
        it("should create instance with config", () => {
            const uploadClient = new UploadClient({
                baseUrl: "https://test.com",
                timeout: 5000,
            });

            expect(uploadClient).toBeInstanceOf(UploadClient);
        });
    });

    describe("upload method", () => {
        it("should create upload with auto protocol selection", async () => {
            const mockFile = new File(["test"], "test.txt");

            // Mock the upload method to return a mock upload object
            const mockUpload = {
                id: "test-id",
                state: "pending",
                file: mockFile,
                progress: { id: "test-id", loaded: 0, total: 4, percentage: 0 },
                start: vi.fn(),
                pause: vi.fn(),
                cancel: vi.fn(),
                getUrl: vi.fn(),
            };

            // Mock multipart client for small files
            const MultipartClient = (await import("../src/multipart-client")).MultipartClient;
            const mockMultipartClient = MultipartClient.mock.results[0].value;
            mockMultipartClient.upload.mockResolvedValue({
                id: "test-id",
                url: "https://api.example.com/files/test-id",
                metadata: { name: "test.txt" },
                size: 4,
            });

            const upload = await client.upload({
                file: mockFile,
            });

            expect(upload).toBeDefined();
            expect(upload.id).toBeDefined();
            expect(upload.file).toBe(mockFile);
        });

        it("should use Tus protocol when specified", async () => {
            const mockFile = new File(["x".repeat(1000000)], "large.txt"); // 1MB file

            const TusClient = (await import("../src/tus-client")).TusClient;
            const mockTusClient = TusClient.mock.results[0].value;
            mockTusClient.createUpload.mockResolvedValue({
                id: "tus-id",
                state: "pending",
                file: mockFile,
                progress: { id: "tus-id", loaded: 0, total: 1000000, percentage: 0 },
                start: vi.fn(),
                pause: vi.fn(),
                cancel: vi.fn(),
                getUrl: vi.fn(),
            });

            const upload = await client.upload({
                file: mockFile,
                protocol: "tus",
            });

            expect(mockTusClient.createUpload).toHaveBeenCalled();
            expect(upload.id).toBe("tus-id");
        });

        it("should use multipart protocol when specified", async () => {
            const mockFile = new File(["test"], "test.txt");

            // For multipart protocol, it creates a wrapper that calls multipartClient.upload
            const MultipartClient = (await import("../src/multipart-client")).MultipartClient;
            const mockMultipartClient = MultipartClient.mock.results[0].value;
            mockMultipartClient.upload.mockResolvedValue({
                id: "multipart-id",
                url: "https://api.example.com/files/multipart-id",
                metadata: { name: "test.txt" },
                size: 4,
            });

            const upload = await client.upload({
                file: mockFile,
                protocol: "multipart",
            });

            // Start the upload to trigger the actual multipart call
            await upload.start();

            expect(mockMultipartClient.upload).toHaveBeenCalled();
        });
    });

    describe("resumeUpload method", () => {
        it("should resume upload using Tus protocol", async () => {
            const mockFile = new File(["test"], "test.txt");

            const TusClient = (await import("../src/tus-client")).TusClient;
            const mockTusClient = TusClient.mock.results[0].value;
            mockTusClient.resumeUpload.mockResolvedValue({
                id: "resumed-id",
                state: "uploading",
                file: mockFile,
                progress: { id: "resumed-id", loaded: 2, total: 4, percentage: 50 },
                start: vi.fn(),
                pause: vi.fn(),
                cancel: vi.fn(),
                getUrl: vi.fn(),
            });

            const upload = await client.resumeUpload("https://api.example.com/files/123", {
                file: mockFile,
            });

            expect(mockTusClient.resumeUpload).toHaveBeenCalledWith(
                "https://api.example.com/files/123",
                expect.any(Object)
            );
            expect(upload.id).toBe("resumed-id");
            expect(upload.progress.percentage).toBe(50);
        });
    });

    describe("delete method", () => {
        it("should delete uploaded file", async () => {
            const MultipartClient = (await import("../src/multipart-client")).MultipartClient;
            const mockMultipartClient = MultipartClient.mock.results[0].value;
            mockMultipartClient.delete.mockResolvedValue(undefined);

            await client.delete("https://api.example.com/files/123");

            expect(mockMultipartClient.delete).toHaveBeenCalledWith("https://api.example.com/files/123");
        });
    });

    describe("getMetadata method", () => {
        it("should get file metadata", async () => {
            const mockMetadata = { name: "test.txt", size: 100 };

            const MultipartClient = (await import("../src/multipart-client")).MultipartClient;
            const mockMultipartClient = MultipartClient.mock.results[0].value;
            mockMultipartClient.getMetadata.mockResolvedValue(mockMetadata);

            const metadata = await client.getMetadata("https://api.example.com/files/123");

            expect(mockMultipartClient.getMetadata).toHaveBeenCalledWith("https://api.example.com/files/123");
            expect(metadata).toEqual(mockMetadata);
        });
    });

    describe("getServerCapabilities method", () => {
        it("should return server capabilities", async () => {
            const tusCapabilities = {
                version: "1.0.0",
                extensions: ["creation", "termination"],
                maxSize: 1000000,
                checksumAlgorithms: ["md5", "sha1"],
            };

            const TusClient = (await import("../src/tus-client")).TusClient;
            const mockTusClient = TusClient.mock.results[0].value;
            mockTusClient.getServerCapabilities.mockResolvedValue(tusCapabilities);

            const capabilities = await client.getServerCapabilities();

            expect(capabilities.tus).toEqual(tusCapabilities);
            expect(capabilities.multipart).toBeDefined();
        });
    });
});
