declare module "launch-editor-middleware" {
    import type { IncomingMessage, ServerResponse } from "node:http";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type NextFunction = (error?: any) => void;

    const create: (
        specifiedEditor?: string,
        sourceRoot?: string,
        onErrorCallback?: (error: Error) => void,
    ) => (request: IncomingMessage, response: ServerResponse, next: NextFunction) => void;

    export default create;
}
