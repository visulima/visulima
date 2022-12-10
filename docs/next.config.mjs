import nextra from "nextra";

const withNextra = nextra({
    theme: "@visulima/nextra-theme-docs",
    themeConfig: "./theme.config.tsx",
    staticImage: true,
    flexsearch: {
        codeblocks: true,
    },
    defaultShowCopyCode: true
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    i18n: {
        locales: ["en-US"],
        defaultLocale: "en-US",
    },
};

export default withNextra(nextConfig);
