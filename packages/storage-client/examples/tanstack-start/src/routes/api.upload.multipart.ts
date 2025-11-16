import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileRoute } from "@tanstack/react-router";
import { DiskStorage, Multipart } from "@visulima/storage";

// Initialize storage and multipart handler
const uploadDirectory = join(tmpdir(), "visulima-uploads");
const storage = new DiskStorage({ directory: uploadDirectory });
const multipart = new Multipart({ storage });

export const Route = createFileRoute("/api/upload/multipart")({
    server: {
        handlers: {
            OPTIONS: () =>
                // Handle CORS preflight
                new Response(null, {
                    headers: {
                        "Access-Control-Allow-Headers": "Content-Type",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Origin": "*",
                    },
                    status: 204,
                }),
            POST: async ({ request }) => await multipart.fetch(request),
        },
    },
});
