/// <reference types="vite/client" />
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";

import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            ...seo({
                title: "TanStack Start + Dev Toolbar",
                description: "TanStack Start example with @visulima/dev-toolbar integration.",
            }),
        ],
        links: [
            { rel: "stylesheet", href: appCss },
            { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
            { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
            { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
            { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
            { rel: "icon", href: "/favicon.ico" },
        ],
    }),
    errorComponent: (props) => {
        return (
            <RootLayout>
                <DefaultCatchBoundary {...props} />
            </RootLayout>
        );
    },
    notFoundComponent: () => <NotFound />,
    component: RootComponent,
});

function RootComponent() {
    return (
        <RootLayout>
            <Outlet />
        </RootLayout>
    );
}

function RootLayout({ children }: { children: React.ReactNode }) {
    React.useEffect(() => {
        // ── Hook system ──────────────────────────────────────────────────────
        if (typeof window !== "undefined" && window.__DEV_TOOLBAR_HOOK__) {
            const hook = window.__DEV_TOOLBAR_HOOK__;

            hook.on("devtools:init", () => {
                console.log("[TanStack Start] Dev Toolbar initialized!");
            });

            hook.on("devtools:open", (appId: string) => {
                console.log(`[TanStack Start] App opened: ${appId}`);
            });

            hook.addTimelineEvent("custom", {
                data: { framework: "TanStack Start", message: "Root mounted!" },
                id: "tanstack-start-mount",
                level: "info",
                time: Date.now(),
                title: "TanStack Start Mounted",
            });
        }
    }, []);

    return (
        <html>
            <head>
                <HeadContent />
            </head>
            <body>
                {children}
                <TanStackRouterDevtools position="bottom-right" />
                <Scripts />
            </body>
        </html>
    );
}
