import { createFileRoute } from "@tanstack/react-router";

import Brand from "@/pages/brand";

export const Route = createFileRoute("/brand")({
    component: () => <Brand />,
});
