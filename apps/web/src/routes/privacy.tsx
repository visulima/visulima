import { createFileRoute } from "@tanstack/react-router";

const RouteComponent = () => <div>Hello "/privacy"!</div>;

export const Route = createFileRoute("/privacy")({
    component: RouteComponent,
});
