declare module "ai" {
    export type LanguageModelV1 = unknown;
    export function generateText(args: unknown): Promise<{ text: string }>;
}
