import nextra from "nextra";

const withNextra = nextra({
    theme: "@visulima/nextra-theme-docs",
    themeConfig: "./theme.config.tsx",
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
