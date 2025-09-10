declare module "launch-editor-middleware" {
    import type { IncomingMessage, ServerResponse } from "node:http";

    type NextFunction = (error?: any) => void;

    const create: (
        specifiedEditor?: string,
        sourceRoot?: string,
        onErrorCallback?: (error: Error) => void,
    ) => (request: IncomingMessage, res: ServerResponse, next: NextFunction) => void;

    export default create;
}
