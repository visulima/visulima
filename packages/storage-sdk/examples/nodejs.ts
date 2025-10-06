#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { UploadClient, TusClient, MultipartClient } from "../src/index";

/**
 * Node.js example demonstrating @visulima/upload-client usage
 */
async function main() {
    const serverUrl = process.env.UPLOAD_SERVER_URL || "http://localhost:3000";

    console.log("🚀 @visulima/upload-client Node.js Example");
    console.log(`📡 Server: ${serverUrl}`);
    console.log();

    // Example 1: Basic upload with auto protocol selection
    console.log("📤 Example 1: Basic upload with auto protocol selection");
    await exampleBasicUpload(serverUrl);

    // Example 2: Tus resumable upload
    console.log("\n📤 Example 2: Tus resumable upload");
    await exampleTusUpload(serverUrl);

    // Example 3: Multipart upload
    console.log("\n📤 Example 3: Multipart upload");
    await exampleMultipartUpload(serverUrl);

    // Example 4: Error handling and retries
    console.log("\n📤 Example 4: Error handling and retries");
    await exampleErrorHandling(serverUrl);

    console.log("\n✅ All examples completed!");
}

/**
 * Basic upload with automatic protocol selection
 */
async function exampleBasicUpload(serverUrl: string) {
    const client = new UploadClient({
        baseUrl: serverUrl,
        timeout: 10000,
    });

    // Create a sample file
    const sampleContent = "This is a test file content for upload demonstration.";
    const blob = new Blob([sampleContent], { type: "text/plain" });
    const file = new File([blob], "sample.txt");

    try {
        const upload = await client.upload({
            file,
            metadata: {
                description: "Sample file for basic upload example",
                tags: ["example", "basic"],
            },
            onProgress: (progress) => {
                console.log(`  Progress: ${progress.percentage}% (${progress.loaded}/${progress.total} bytes)`);
            },
            onComplete: (result) => {
                console.log(`  ✅ Upload complete!`);
                console.log(`  📄 File URL: ${result.url}`);
                console.log(`  🆔 Upload ID: ${result.id}`);
                console.log(`  📏 File size: ${result.size} bytes`);
            },
            onError: (error) => {
                console.error(`  ❌ Upload failed: ${error.message}`);
            },
        });

        await upload.start();
    } catch (error) {
        console.error(`  ❌ Failed to create upload: ${(error as Error).message}`);
    }
}

/**
 * Tus resumable upload example
 */
async function exampleTusUpload(serverUrl: string) {
    const tusClient = new TusClient({
        baseUrl: serverUrl,
        chunkSize: 1024, // Small chunks for demo
        timeout: 5000,
    });

    // Create a larger sample file
    const sampleContent = "A".repeat(5000); // 5KB file
    const blob = new Blob([sampleContent], { type: "text/plain" });
    const file = new File([blob], "large-sample.txt");

    try {
        console.log("  Creating Tus upload...");

        const upload = await tusClient.createUpload({
            file,
            metadata: {
                description: "Large sample file for Tus upload example",
                type: "text",
            },
            onStart: (upload) => {
                console.log(`  🚀 Upload started (ID: ${upload.id})`);
            },
            onProgress: (progress) => {
                console.log(`  📊 Progress: ${progress.percentage}% (${progress.loaded}/${progress.total} bytes)`);
                if (progress.speed) {
                    console.log(`  ⚡ Speed: ${progress.speed} B/s`);
                }
                if (progress.eta) {
                    console.log(`  ⏱️  ETA: ${Math.round(progress.eta)}s`);
                }
            },
            onComplete: (result) => {
                console.log(`  ✅ Tus upload complete!`);
                console.log(`  📄 File URL: ${result.url}`);
            },
            onError: (error) => {
                console.error(`  ❌ Tus upload failed: ${error.message}`);
            },
        });

        // Demonstrate pause/resume
        await upload.start();

        // Wait a bit then pause
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log("  ⏸️  Pausing upload...");
        await upload.pause();

        // Resume after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("  ▶️  Resuming upload...");
        await upload.start();

    } catch (error) {
        console.error(`  ❌ Failed to create Tus upload: ${(error as Error).message}`);
    }
}

/**
 * Multipart upload example
 */
async function exampleMultipartUpload(serverUrl: string) {
    const multipartClient = new MultipartClient({
        baseUrl: serverUrl,
        maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    // Create a sample file
    const sampleContent = "This is content for multipart upload.";
    const blob = new Blob([sampleContent], { type: "text/plain" });
    const file = new File([blob], "multipart-sample.txt");

    try {
        console.log("  Uploading with multipart...");

        const result = await multipartClient.upload({
            file,
            fieldName: "document",
            metadata: {
                category: "example",
                uploadedBy: "nodejs-client",
            },
            formData: {
                userId: "12345",
                public: "true",
            },
        });

        console.log(`  ✅ Multipart upload complete!`);
        console.log(`  📄 File URL: ${result.url}`);
        console.log(`  📏 File size: ${result.size} bytes`);

    } catch (error) {
        console.error(`  ❌ Multipart upload failed: ${(error as Error).message}`);
    }
}

/**
 * Error handling and retry example
 */
async function exampleErrorHandling(serverUrl: string) {
    const client = new UploadClient({
        baseUrl: serverUrl,
        retries: 2,
        retryDelay: 1000,
        timeout: 2000, // Short timeout to potentially trigger errors
    });

    // Create a sample file
    const sampleContent = "Content for error handling example.";
    const blob = new Blob([sampleContent], { type: "text/plain" });
    const file = new File([blob], "error-example.txt");

    try {
        console.log("  Testing error handling with retries...");

        const upload = await client.upload({
            file,
            onProgress: (progress) => {
                console.log(`  📊 Progress: ${progress.percentage}%`);
            },
            onComplete: (result) => {
                console.log(`  ✅ Upload succeeded after retries!`);
                console.log(`  📄 File URL: ${result.url}`);
            },
            onError: (error) => {
                console.error(`  ❌ Upload failed after retries: ${error.message}`);
                if (error.statusCode) {
                    console.error(`  📊 HTTP Status: ${error.statusCode}`);
                }
            },
        });

        await upload.start();

    } catch (error) {
        console.error(`  ❌ Failed to create upload: ${(error as Error).message}`);

        // Demonstrate different error types
        if ((error as any).code === "ECONNREFUSED") {
            console.log("  💡 Tip: Make sure the upload server is running");
        }
    }
}

// Run the examples
main().catch((error) => {
    console.error("❌ Example failed:", error);
    process.exit(1);
});
