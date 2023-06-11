import nextra from "nextra";
import { remarkCodeHike } from "@code-hike/mdx";
import theme from "shiki/themes/nord.json" assert { type: "json" };

const withNextra = nextra({
    theme: "@visulima/nextra-theme-docs",
    themeConfig: "./theme.config.tsx",
    mdxOptions: {
        remarkPlugins: [[remarkCodeHike, { theme, lineNumbers: true, showCopyButton: true }]],
    },
    staticImage: true,
    search: {
        codeblocks: true,
    },
    defaultShowCopyCode: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
};

export default withNextra(nextConfig);
