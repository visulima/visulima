import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

const RootDocument = (props: { children: React.ReactNode }) => (
    <html lang="en">
        <head>
            <HeadContent />
        </head>
        <body>
            {props.children}
            <Scripts />
        </body>
    </html>
);

export const Route = createRootRoute({
    head: () => {
        return {
            meta: [
                {
                    charSet: "utf-8",
                },
                {
                    content: "width=device-width, initial-scale=1",
                    name: "viewport",
                },
                {
                    title: "Storage Upload Example - TanStack Start",
                },
            ],
        };
    },

    shellComponent: RootDocument,
});
