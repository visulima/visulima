import { createFileRoute } from "@tanstack/react-router";

import { createSeoHead } from "@/lib/seo";

const RouteComponent = () => <div>Hello "/privacy"!</div>;

export const Route = createFileRoute("/privacy")({
    component: RouteComponent,
    head: () => ({
        ...createSeoHead({
            description: "Visulima privacy policy detailing how we collect, use, and protect your personal data.",
            path: "/privacy",
            title: "Privacy Policy",
        }),
    }),
});
