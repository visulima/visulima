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
            // Overriding rehypeCodeOptions replaces fumadocs' defaults, so the default
            // light/dark themes must be restated here to keep code-block rendering identical.
            themes: {
                dark: "github-dark",
                light: "github-light",
            },
            // `tera` has no Shiki grammar; alias it to `jinja` and preload that grammar.
            // Lazy loading only auto-loads bundled language ids, not alias keys, so without
            // an explicit preload the alias target never loads and Shiki throws "tera not found".
            langs: ["jinja"],
            langAlias: {
                tera: "jinja",
            },
        },
    },
    plugins: [lastModified()],
});
