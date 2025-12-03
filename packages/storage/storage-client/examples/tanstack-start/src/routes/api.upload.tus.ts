import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/upload/tus")({
    server: {
        handlers: {},
    },
});
