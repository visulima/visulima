import type * as rollup from "rollup";
import type { RawSourceMap } from "source-map-js";

/**
 * Loader
 * @param T type of loader's options
 */
export interface Loader<T = Record<string, unknown>> {
    /** Skip testing, always process the file */
    alwaysProcess?: boolean;
    /** Name */
    name: string;
    /** Function for processing */
    process: (this: LoaderContext<T>, payload: Payload) => Payload | Promise<Payload>;
    /**
     * Test to control if file should be processed.
     * Also used for plugin's supported files test.
     */
    test?: RegExp | ((file: string) => boolean);
}

/**
 * Loader's context
 * @param T type of loader's options
 */
export interface LoaderContext<T = Record<string, unknown>> {
    /** Assets to emit */
    readonly assets: Map<string, Uint8Array>;
    /** Files to watch */
    readonly deps: Set<string>;
    /** Resource path */
    readonly id: string;
    /**
     * Loader's options
     * @default {}
     */
    readonly options: T;
    /** [Plugin's context](https://rollupjs.org/guide/en#plugin-context) */
    readonly plugin: rollup.PluginContext;
    /** @see {@link Options.sourceMap} */
    readonly sourceMap: false | (SourceMapOptions & { inline: boolean });
    /** [Function for emitting a warning](https://rollupjs.org/guide/en/#thiswarnwarning-string--rollupwarning-position-number---column-number-line-number---void) */
    readonly warn: rollup.PluginContext["warn"];
}

/** Extracted data */
export interface Extracted {
    /** CSS */
    css: string;
    /** Source file path */
    id: string;
    /** Sourcemap */
    map?: string;
}

/** Loader's payload */
export interface Payload {
    /** File content */
    code: string;
    /** Extracted data */
    extracted?: Extracted;
    /** Sourcemap */
    map?: string;
}

/** Options for sourcemaps */
export interface SourceMapOptions {
    /**
     * Include sources content
     * @default true
     */
    content?: boolean;
    /** Function for transforming resulting sourcemap */
    transform?: (map: RawSourceMap, name?: string) => void;
}
