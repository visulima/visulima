export const seo = ({ description, image, keywords, title }: { description?: string; image?: string; keywords?: string; title: string }) => {
    const tags = [
        { title },
        { content: description, name: "description" },
        { content: keywords, name: "keywords" },
        { content: title, name: "twitter:title" },
        { content: description, name: "twitter:description" },
        { content: "@tannerlinsley", name: "twitter:creator" },
        { content: "@tannerlinsley", name: "twitter:site" },
        { content: "website", name: "og:type" },
        { content: title, name: "og:title" },
        { content: description, name: "og:description" },
        ...(image
            ? [
                  { content: image, name: "twitter:image" },
                  { content: "summary_large_image", name: "twitter:card" },
                  { content: image, name: "og:image" },
              ]
            : []),
    ];

    return tags;
};
