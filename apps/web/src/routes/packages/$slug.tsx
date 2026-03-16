import { createFileRoute, notFound } from "@tanstack/react-router";

import { createSeoHead } from "@/lib/seo";
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
    head: ({ loaderData }) => {
        if (!loaderData?.pkg) {
            return {};
        }

        return {
            ...createSeoHead({
                description: loaderData.pkg.description,
                ogImage: `https://visulima.com/api/og?slug=${loaderData.pkg.slug}`,
                path: `/packages/${loaderData.pkg.slug}`,
                title: `${loaderData.pkg.name} - ${loaderData.pkg.category}`,
            }),
        };
    },
});
