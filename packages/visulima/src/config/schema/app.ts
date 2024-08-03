import { z } from "zod";

const app = z
    .object({
        /**
         * The base path of your Visulima application.
         *
         * This can be set at runtime by setting the VISULIMA_APP_BASE_URL environment variable.
         * @example
         * ```bash
         * VISULIMA_APP_BASE_URL=/prefix/ node .output/server/index.mjs
         * ```
         */
        baseURL: z.string().default(() => process.env["VISULIMA_APP_BASE_URL"] ?? "/"),
        /** The folder name for the built site assets, relative to `baseURL` (or `cdnURL` if set). This is set at build time and should not be customized at runtime. */
        buildAssetsDir: z.string().default(() => process.env["VISULIMA_APP_BUILD_ASSETS_DIR"] ?? "/_visulima/"),
        csr: z.boolean().default(false),
        /** You can switch between react and preact by setting this option. */
        preset: z.enum(["react", "preact"]).default("react"),
        /** Customize Visulima root element id. */
        rootId: z.string().default("__visulima"),
        /**
         * Customize Visulima root element tag.
         */
        rootTag: z.string().default("div"),
        ssr: z.boolean().default(true),
    })
    .default({});

export type AppSchema = z.infer<typeof app>;

export default app;
