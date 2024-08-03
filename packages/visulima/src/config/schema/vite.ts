import { z } from "zod";
import type { UserConfig } from "vite";

const vite = z
    .object({
        base: z.string().optional().default("/"),
        build: z
            .object({
                assetsDir: z.string().optional(),
                emptyOutDir: z.boolean().default(false),
            })
            .optional()
            .default({}),
        define: z.record(z.unknown()).optional(),
        esbuild: z
            .object({
                jsxFactory: z.string().optional(),
                jsxFragment: z.string().optional(),
                tsconfigRaw: z.string().optional(),
            })
            .default({})
            .optional(),
        mode: z.string().optional(),
        optimizeDeps: z
            .object({
                exclude: z
                    .array(z.string())
                    .transform((value) => [...(value || []), ...[].filter((index: string) => typeof index === "string")])
                    .default([]), // get the second array somehow
            })
            .optional()
            .default({}),
        plugins: z.custom<UserConfig["plugins"]>().optional().default([]),
        resolve: z
            .object({
                extensions: z.array(z.string()).default([".mjs", ".js", ".ts", ".cts", ".mts", ".jsx", ".tsx", ".json"]),
            })
            .optional()
            .default({}),
        server: z
            .object({
                fs: z
                    .object({
                        allow: z.array(z.string()).default([]),
                    })
                    .default({}),
            })
            .default({}),
    })
    .default({});

export type ViteSchema = z.infer<typeof vite>;

export default vite;
