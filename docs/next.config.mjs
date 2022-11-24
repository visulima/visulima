import nextra from "nextra";

const withNextra = nextra({
    theme: "./src/theme",
    themeConfig: "./theme.config.tsx",
    unstable_staticImage: true,
    unstable_flexsearch: {
        codeblocks: true,
    },
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
