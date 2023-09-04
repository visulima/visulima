const { withOpenApi } = require("@visulima/api-platform/framework/next");

const packageJson = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3000",
    },
    reactStrictMode: true,
    swcMinify: true,
    transpilePackages: ["openapi-client", "openapi-ui-react"],
};

module.exports = withOpenApi({
    definition: {
        info: {
            description: packageJson.description,
            title: packageJson.name,
            version: packageJson.version,
        },
    },
    sources: ["pages/api"],
    verbose: false,
})(nextConfig);
