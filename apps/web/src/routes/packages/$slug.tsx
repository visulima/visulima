import { createFileRoute, notFound } from "@tanstack/react-router";

import { getPackageBySlug } from "@/data/packages";
import PackageDetail from "@/pages/packages/detail";

export const Route = createFileRoute("/packages/$slug")({
    component: () => <PackageDetail />,
    loader: ({ params }) => {
        const pkg = getPackageBySlug(params.slug);

        if (!pkg) {
            throw notFound();
        }

        return { pkg };
    },
});
