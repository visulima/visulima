declare module "jstoxml" {
    export interface JsToXmlOptions {
        attributeExplicitTrue?: boolean;
        attributeFilter?: (key: string, value: unknown) => boolean;
        attributeReplacements?: Record<string, string>;
        contentMap?: (content: string) => string;
        contentReplacements?: Record<string, string>;
        header?: string | boolean;
        indent?: string;
        selfCloseTags?: boolean;
    }

    export function toXML(input: unknown, options?: JsToXmlOptions): string;
}
