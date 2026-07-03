import { createFileRoute } from "@tanstack/react-router";

import { createSeoHead } from "@/lib/seo";
import Home from "@/pages/home";

export const Route = createFileRoute("/")({
    component: () => <Home />,
    head: () => {
        return {
            ...createSeoHead({
                description:
                    "A collection of high-quality, modular TypeScript packages for Node.js, browsers, and edge runtimes. Build faster with Packem, Pail, Cerebro, and 40+ open-source tools.",
                path: "/",
                title: "Visulima",
            }),
        };
    },
});
