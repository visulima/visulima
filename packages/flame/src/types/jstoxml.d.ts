declare module "jstoxml" {
    export interface JsToXmlOptions {
        indent?: string;
        header?: string | boolean;
        attributeReplacements?: Record<string, string>;
        attributeFilter?: (key: string, value: unknown) => boolean;
        attributeExplicitTrue?: boolean;
        contentMap?: (content: string) => string;
        contentReplacements?: Record<string, string>;
        selfCloseTags?: boolean;
    }

    export function toXML(input: unknown, options?: JsToXmlOptions): string;
}


