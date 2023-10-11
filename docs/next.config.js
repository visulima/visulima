import { remarkCodeHike } from "@code-hike/mdx";
import nextra from "nextra";
import theme from "shiki/themes/nord.json" assert { type: "json" };

const withNextra = nextra({
    mdxOptions: {
        remarkPlugins: [[remarkCodeHike, { lineNumbers: false, showCopyButton: true, skipLanguages: ["mermaid"], theme }]],
    },
    search: {
        codeblocks: true,
    },
    staticImage: true,
    theme: "@visulima/nextra-theme-docs",
    themeConfig: "./theme.config.tsx",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: ["images.unsplash.com"],
    },
    reactStrictMode: true,
    swcMinify: true,
};

// eslint-disable-next-line import/no-unused-modules
export default withNextra(nextConfig);
