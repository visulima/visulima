import { remarkCodeHike } from "@code-hike/mdx";
import nextra from "nextra";
import theme from "shiki/themes/nord.json" assert { type: "json" };

const withNextra = nextra({
    defaultShowCopyCode: true,
    mdxOptions: {
        remarkPlugins: [[remarkCodeHike, { lineNumbers: true, showCopyButton: true, theme }]],
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
    reactStrictMode: true,
    swcMinify: true,
};

export default withNextra(nextConfig);
