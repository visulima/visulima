import { z } from "zod";

const build = z
    .object({
        /**
         * Visulima uses `rollup-plugin-visualizer` to visualize your bundles and how to optimize them.
         *
         * Set to `true` to enable bundle analysis, or pass an object with options: [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
         * @example
         * ```js
         * analyze: {
         *   analyzerMode: 'static'
         * }
         * ```
         * @type {boolean | typeof import('rollup-plugin-visualizer').PluginVisualizerOptions}
         */
        analyze: z.union([z.boolean(), z.record(z.unknown())]).default(false),
    })
    .default({});

export type BuildSchema = z.infer<typeof build>;

export default build;
