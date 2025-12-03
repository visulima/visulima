import { defineConfig } from "taze";

export default defineConfig({
    // ignore packages from bumping
    exclude: [
        "read-pkg-up",
        "chalk",
        "next",
        "@types/node",
        "prisma",
        "@prisma/client",
        "@types/swagger-ui-react",
        "swagger-ui-dist",
        "swagger-ui-react",
        "eslint",
        "eslint-plugin-vitest",
    ],
    // write to package.json
    write: true,
    ignorePaths: ["node_modules", "packages/**/**/dist", "packages/**/**/coverage", "packages/**/**/__fixtures__", "packages/**/**/__tests__"],
    recursive: true,
    mode: "latest",
});
