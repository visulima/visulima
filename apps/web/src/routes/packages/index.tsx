import { createFileRoute } from "@tanstack/react-router";

import { createSeoHead } from "@/lib/seo";
import PackagesListing from "@/pages/packages";

export const Route = createFileRoute("/packages/")({
    component: () => <PackagesListing />,
    head: () => {
        return {
            ...createSeoHead({
                description:
                    "Browse 40+ open-source TypeScript packages for bundling, CLI tools, data manipulation, file system utilities, API development, and more.",
                path: "/packages",
                title: "Packages",
            }),
        };
    },
});
