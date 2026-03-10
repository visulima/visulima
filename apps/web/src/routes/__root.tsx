import "unfonts.css";

import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import type { FC, PropsWithChildren } from "react";
import { lazy, Suspense } from "react";

import Footer from "@/components/sections/footer";
import Navbar from "@/components/sections/navbar";
import { NotFound } from "@/pages/not-found";
import appCss from "@/styles/app.css?url";

const TanStackRouterDevtools =
    process.env.NODE_ENV === "production"
        ? () => null // Render nothing in production
        : lazy(() =>
              // Lazy load in development
              import("@tanstack/react-router-devtools").then((res) => {
                  return {
                      default: res.TanStackRouterDevtools,
                  };
              }),
          );

const RootDocument: FC<PropsWithChildren> = ({ children }) => (
    <html lang="en" suppressHydrationWarning>
        <head>
            <HeadContent />
        </head>
        <body>
            <div className="bg-ivory relative isolate font-sans antialiased">
                <svg aria-hidden="true" height="0" width="0">
                    <defs>
                        <pattern height="4" id="pattern-ivory" patternUnits="userSpaceOnUse" width="1">
                            <rect className="fill-ivory" height="1" width="1" />
                        </pattern>
                        <pattern height="4" id="pattern-sky-sapphire" patternUnits="userSpaceOnUse" width="1">
                            <rect className="fill-sky-sapphire" height="1" width="1" />
                        </pattern>
                        <pattern height="4" id="pattern-crimson-energy" patternUnits="userSpaceOnUse" width="1">
                            <rect className="fill-crimson-energy" height="1" width="1" />
                        </pattern>
                        <pattern height="4" id="pattern-royal-amethyst" patternUnits="userSpaceOnUse" width="1">
                            <rect className="fill-royal-amethyst" height="1" width="1" />
                        </pattern>
                    </defs>
                </svg>

                <RootProvider search={{ enabled: true }} theme={{ enabled: true, defaultTheme: "dark", forcedTheme: "dark" }}>
                    <Navbar />
                    <main className="relative">{children}</main>
                </RootProvider>
                <Footer />
            </div>
            <Suspense>
                <TanStackRouterDevtools position="bottom-right" />
            </Suspense>
            <Scripts />
        </body>
    </html>
);

export const Route = createRootRoute({
    component: () => (
        <RootDocument>
            <Outlet />
        </RootDocument>
    ),
    head: () => {
        return {
            links: [
                { href: appCss, rel: "stylesheet" },
                // {
                //     rel: "apple-touch-icon",
                //     sizes: "180x180",
                //     href: "/apple-touch-icon.png",
                // },
                // {
                //     rel: "icon",
                //     type: "image/png",
                //     sizes: "32x32",
                //     href: "/favicon-32x32.png",
                // },
                // {
                //     rel: "icon",
                //     type: "image/png",
                //     sizes: "16x16",
                //     href: "/favicon-16x16.png",
                // },
                // { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
                // { rel: "icon", href: "/favicon.ico" },
                {
                    as: "image",
                    fetchPriority: "high",
                    href: "https://res.cloudinary.com/anolilab/video/upload/ac_none/v1749136422/visulima/slywtsotc6ayuxx5gxok.jpg",
                    rel: "preload",
                    type: "image/jpeg",
                },
            ],
            meta: [
                {
                    charSet: "utf8",
                },
                {
                    content: "width=device-width, initial-scale=1",
                    name: "viewport",
                },
                // ...seo({
                //     title: "TanStack Start | Type-Safe, Client-First, Full-Stack React Framework",
                //     description: `TanStack Start is a type-safe, client-first, full-stack React framework. `,
                // }),
            ],
        };
    },
    notFoundComponent: (props) => <NotFound {...props} />,
});
