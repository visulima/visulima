import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

const RootDocument = ({ children }: { children: React.ReactNode }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
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
