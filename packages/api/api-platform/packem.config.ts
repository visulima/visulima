import type { BuildConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    externals: [
        /^next($|\/)/,
        /^react($|\/)/,
        /^react-dom($|\/)/,
        /^@prisma\/client($|\/)/,
        /^webpack($|\/)/,
        /^express($|\/)/,
        /^koa($|\/)/,
        /^@koa\/router($|\/)/,
        /^@hapi\/hapi($|\/)/,
        /^fastify($|\/)/,
        /^swagger-ui-react($|\/)/,
        /^swagger-ui-dist($|\/)/,
        /^redoc($|\/)/,
        /^styled-components($|\/)/,
        /^dotenv($|\/)/,
        /^type-fest($|\/)/,
    ],
    node10Compatibility: {
        writeToPackageJson: true,
        typeScriptVersion: ">=5.0",
    },
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    // TODO: isolatedDeclarationTransformer triggers a packem bug in fix-dts-default-cjs-exports plugin
    // (Cannot read properties of undefined reading 'includes' in extractExports).
    // Re-enable once https://github.com/visulima/visulima/issues/XXX is fixed.
    isolatedDeclarationTransformer,
    cjsInterop: true,
}) as BuildConfig;
