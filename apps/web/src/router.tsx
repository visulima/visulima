import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/pages/not-found";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof createRouter>;
    }
}

// eslint-disable-next-line import/prefer-default-export, @typescript-eslint/explicit-module-boundary-types
export const createRouter = () =>
    createTanStackRouter({
        defaultErrorComponent: DefaultCatchBoundary,
        defaultNotFoundComponent: NotFound,
        defaultPreload: "intent",
        defaultStaleTime: 0,
        defaultViewTransition: true,
        routeTree,
        scrollRestoration: true,
    });
