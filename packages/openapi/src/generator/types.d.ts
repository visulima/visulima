import type { BaseDefinition } from "../../exported";

export interface Options {
    exclude?: ReadonlyArray<string> | string;
    extensions?: string[];
    include: string[];
    outputFilePath: string;
    stopOnInvalid?: boolean;
    swaggerDefinition: BaseDefinition;
    verbose?: boolean;
}
