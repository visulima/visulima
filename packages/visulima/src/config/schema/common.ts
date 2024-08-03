import { resolve } from "@visulima/path";
import { isDebug, isDevelopment, isTest } from "std-env";
import { z } from "zod";

const common = z.object({
    /**
     * The directory where Visulima will store the generated files when running `visulima analyze`.
     *
     * If a relative path is specified, it will be relative to your `rootDir`.
     */
    analyzeDir: z.string().optional(),

    /**
     * Define the directory where your built Visulima files will be placed.
     *
     * Many tools assume that `.visulima` is a hidden directory (because it starts
     * with a `.`). If that is a problem, you can use this option to prevent that.
     * @example
     * ```js
     * export default {
     *   buildDir: 'visulima-build'
     * }
     * ```
     */
    buildDir: z.string().default(".visulima"),

    /**
     * Set to `true` to enable debug mode.
     *
     * At the moment, it prints out hook names and timings on the server, and
     * logs hook arguments as well in the browser.
     *
     */
    debug: z.boolean().default(Boolean(isDebug)),

    /**
     * Whether Visulima is running in development mode.
     *
     * Normally, you should not need to set this.
     */
    dev: z.boolean().default(Boolean(isDevelopment)),

    /**
     * Customize default directory structure used by Visulima.
     *
     * It is better to stick with defaults unless needed.
     */
    dir: z
        .object({
            /**
             * The assets directory (aliased as `~assets` in your build).
             */
            assets: z.string().default("assets"),
            /**
             * The middleware directory, each file of which will be auto-registered as a Visulima middleware.
             */
            middleware: z.string().default("middleware"),
            /**
             * The directory which will be processed to auto-generate your application page routes.
             */
            pages: z.string().default("pages"),
            /**
             * The directory containing your static files, which will be directly accessible via the Visulima server
             * and copied across into your `dist` folder when your app is generated.
             */
            public: z.string().default("public"),

            server: z.string().default("server"),
        })
        .default({}),

    /**
     * The extensions that should be resolved by the Visulima resolver.
     */
    extensions: z.array(z.string()).default([".js", ".mjs", ".ts", ".tsx", ".jsx", ".mts", ".cts"]),

    /**
     * More customizable than `ignorePrefix`: all files matching glob patterns specified
     * inside the `ignore` array will be ignored in building.
     */
    ignore: z
        .array(z.string())
        .transform((argument) => {
            const set = new Set<string>(argument);

            [
                "**/*.stories.{js,cts,mts,ts,jsx,tsx}", // ignore storybook files
                "**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}", // ignore tests
                "**/*.d.{cts,mts,ts}", // ignore type declarations
                "**/.{pnpm-store,vercel,netlify,output,git,cache,data}",
            ].forEach((item) => {
                set.add(item);
            });

            return [...set];
        })
        .default([]),

    /**
     * Pass options directly to `node-ignore` (which is used by Visulima to ignore files).
     * @see [node-ignore](https://github.com/kaelzhang/node-ignore)
     * @example
     * ```js
     * ignoreOptions: {
     *   ignorecase: false
     * }
     * ```
     */
    ignoreOptions: z.record(z.unknown()).optional(),

    logLevel: z.enum(["error", "warn", "info", "silent", "verbose"]).default("info"),

    /**
     * Define the root directory of your application.
     *
     * This property can be overwritten (for example, running `visulima ./my-app/`
     * will set the `rootDir` to the absolute path of `./my-app/` from the
     * current/working directory.
     *
     * It is normally not needed to configure this option.
     */
    rootDir: z
        .string()
        .optional()
        .transform((value) => resolve(value ?? process.cwd())),

    /**
     * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time.
     * If set to `false` generated pages will have no content.
     */
    ssr: z.boolean().default(true),

    /**
     * Whether your app is being unit tested.
     */
    test: z.boolean().default(Boolean(isTest)),

    /**
     * The watch property lets you define patterns that will restart the Visulima dev server when changed.
     *
     * It is an array of strings or regular expressions. Strings should be either absolute paths or
     * relative to the `srcDir` (and the `srcDir` of any layers). Regular expressions will be matched
     * against the path relative to the project `srcDir` (and the `srcDir` of any layers).
     * @type {Array<string | RegExp>}
     */
    watch: z.array(z.union([z.string(), z.instanceof(RegExp)])).default([]),
});

export type CommonSchema = z.infer<typeof common>;

export default common;
