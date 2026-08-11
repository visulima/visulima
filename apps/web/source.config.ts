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
    // No `rehypeCodeOptions`: passing `langAlias` makes fumadocs build a private Shiki
    // highlighter per MDX file instead of reusing the shared one, and those copies start
    // empty, so a fence whose grammar has not been lazy-loaded yet fails the build with
    // "Language `ts` not found". Tera has no Shiki grammar of its own — its fences are
    // tagged `jinja`, which Shiki bundles and lazy-loads like every other language.
    mdxOptions: {
        remarkPlugins: [remarkImage],
    },
    plugins: [lastModified()],
});
