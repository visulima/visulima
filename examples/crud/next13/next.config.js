const { withOpenApi } = require("@visulima/api-platform/framework/next");

const packageJson = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3000",
    },
    experimental: {
        transpilePackages: ["openapi-client", "openapi-ui-react"],
    },
    reactStrictMode: true,
    swcMinify: true,
};

module.exports = withOpenApi({
    definition: {
        info: {
            description: packageJson.description,
            title: packageJson.name,
            version: packageJson.version,
        },
        schemes: ["http", "https"],
        servers: [
            {
                url: `${process.env.VERCEL_URL || "http://localhost:3000"}/api`,
            },
        ],
    },
    sources: ["pages/api"],
    verbose: false,
})(nextConfig);
