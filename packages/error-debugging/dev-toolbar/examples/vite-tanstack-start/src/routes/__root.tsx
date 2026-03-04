/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";

import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: (props) => (
        <RootLayout>
            <DefaultCatchBoundary {...props} />
        </RootLayout>
    ),
    head: () => {
        return {
            links: [
                { href: appCss, rel: "stylesheet" },
                { href: "/apple-touch-icon.png", rel: "apple-touch-icon", sizes: "180x180" },
                { href: "/favicon-32x32.png", rel: "icon", sizes: "32x32", type: "image/png" },
                { href: "/favicon-16x16.png", rel: "icon", sizes: "16x16", type: "image/png" },
                { color: "#fffff", href: "/site.webmanifest", rel: "manifest" },
                { href: "/favicon.ico", rel: "icon" },
            ],
            meta: [
                { charSet: "utf-8" },
                { content: "width=device-width, initial-scale=1", name: "viewport" },
                ...seo({
                    description: "TanStack Start example with @visulima/dev-toolbar integration.",
                    title: "TanStack Start + Dev Toolbar",
                }),
            ],
        };
    },
    notFoundComponent: () => <NotFound />,
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
        if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
            const hook = globalThis.__DEV_TOOLBAR_HOOK__;

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
