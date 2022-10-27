const { withOpenApi } = require("@visulima/api-platform/next");
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3001",
    }
};

module.exports = withOpenApi({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Visulima API",
            version: "1.0.0",
        }
    },
    sources: [
        "pages/api",
    ],
    verbose: false,
})(nextConfig);
