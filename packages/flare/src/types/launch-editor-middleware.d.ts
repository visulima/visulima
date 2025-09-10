declare module "launch-editor-middleware" {
    import type { IncomingMessage, ServerResponse } from "http";

    type NextFunction = (err?: any) => void;

    const create: (
        specifiedEditor?: string,
        srcRoot?: string,
        onErrorCallback?: (err: Error) => void,
    ) => (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void;

    export default create;
}
