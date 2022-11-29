const { withOpenApi } = require("@visulima/api-platform/next");

const packageJson = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3000",
    },
    experimental: {
        transpilePackages: ["swagger-client", "swagger-ui-react"],
    },
};

module.exports = withOpenApi({
    definition: {
        info: {
            title: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
        },
    },
    sources: ["pages/api"],
    verbose: false,
})(nextConfig);
