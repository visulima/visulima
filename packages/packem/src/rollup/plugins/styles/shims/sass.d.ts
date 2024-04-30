// eslint-disable-next-line import/no-unused-modules
declare namespace sass {
    type Data = Error | { contents: string } | { file: string } | null;

    type Importer = (url: string, previous: string, done: (data: Data) => void) => Data | void;

    interface PublicOptions {
        data?: string;
        importer?: Importer | Importer[];
        includePaths?: string[];
        indentType?: "space" | "tab";
        indentWidth?: number;
        linefeed?: "cr" | "crlf" | "lf" | "lfcr";
        outputStyle?: "compressed" | "expanded";
    }

    interface Options extends PublicOptions {
        file?: string;
        indentedSyntax?: boolean;
        omitSourceMapUrl?: boolean;
        outFile?: string;
        sourceMap?: boolean | string;
        sourceMapContents?: boolean;
        sourceMapEmbed?: boolean;
        sourceMapRoot?: string;
    }

    interface Exception extends Error {
        column: number;
        file: string;
        formatted: string;
        line: number;
        message: string;
        status: number;
    }

    interface Result {
        css: Uint8Array;
        map?: Uint8Array;
        stats: { includedFiles: string[] };
    }

    type Callback = (exception: Exception, result: Result) => void;

    interface Sass {
        render: (options: Options, callback: Callback) => void;
        renderSync: (options: Options) => Result;
    }
}
