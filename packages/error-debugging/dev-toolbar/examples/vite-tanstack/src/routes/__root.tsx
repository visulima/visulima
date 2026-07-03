import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
    component: () => (
        <>
            <nav className="flex gap-4 bg-gray-900 p-4 text-sm">
                <Link className="text-gray-300 hover:text-white [&.active]:font-bold [&.active]:text-white" to="/">
                    Home
                </Link>
                <Link className="text-gray-300 hover:text-white [&.active]:font-bold [&.active]:text-white" to="/error-test">
                    Error Test
                </Link>
            </nav>
            <Outlet />
            <TanStackRouterDevtools />
        </>
    ),
});
