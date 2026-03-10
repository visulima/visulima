import { createFileRoute } from "@tanstack/react-router";

import Changelog from "@/pages/changelog";

export const Route = createFileRoute("/changelog")({
    component: () => <Changelog data={[]} />,
});
