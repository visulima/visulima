// eslint-disable-next-line import/no-unused-modules
declare namespace stylus {
    type Callback = (error: Error, css: string) => void;

    interface SourceMapOptions {
        basePath?: string;
        comment?: boolean;
        inline?: boolean;
        sourceRoot?: string;
    }

    interface PublicOptions {
        imports?: string[];
        paths?: string[];
    }

    interface Options extends PublicOptions {
        filename?: string;
        sourcemap?: SourceMapOptions;
    }

    interface Renderer {
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        deps(): string[];
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        render(callback: Callback): void;
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        set<T extends keyof Options>(key: T, value: Options[T]): this;
        sourcemap?: {
            file: string;
            mappings: string;
            names: string[];
            sourceRoot?: string;
            sources: string[];
            sourcesContent?: string[];
            version: number;
        };
    }

    type Stylus = (code: string, options?: Options) => Renderer;
}
