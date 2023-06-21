import nextra from "nextra";
import { remarkCodeHike } from "@code-hike/mdx";
import theme from "shiki/themes/nord.json" assert { type: "json" };

const withNextra = nextra({
    theme: "@visulima/nextra-theme-docs",
    themeConfig: "./theme.config.tsx",
    mdxOptions: {
        remarkPlugins: [[remarkCodeHike, { theme, lineNumbers: false, showCopyButton: true, skipLanguages: ["mermaid"] }]],
    },
    staticImage: true,
    search: {
        codeblocks: true,
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: ["images.unsplash.com"],
    },
};

export default withNextra(nextConfig);
