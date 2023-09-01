const { withOpenApi } = require("@visulima/api-platform/framework/next");

const packageJson = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3000",
    },
};

module.exports = withOpenApi({
    definition: {
        info: {
            title: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
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
