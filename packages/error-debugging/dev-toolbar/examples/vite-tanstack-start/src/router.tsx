import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
    const router = createTanStackRouter({
        defaultErrorComponent: DefaultCatchBoundary,
        defaultNotFoundComponent: () => <NotFound />,
        defaultPreload: "intent",
        routeTree,
        scrollRestoration: true,
    });

    return router;
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
