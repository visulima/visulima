import { remarkImage } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";

export const docs = defineDocs({
    dir: "src/content/docs",
    docs: {
        async: true,
        postprocess: {
            includeProcessedMarkdown: true,
        },
    },
});

export default defineConfig({
    mdxOptions: {
        remarkPlugins: [remarkImage],
        rehypeCodeOptions: {
            langAlias: {
                tera: "jinja",
            },
        },
    },
    plugins: [lastModified()],
});
