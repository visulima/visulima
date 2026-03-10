import { createFileRoute } from "@tanstack/react-router";

import PackagesListing from "@/pages/packages";

export const Route = createFileRoute("/packages/")({
    component: () => <PackagesListing />,
});
