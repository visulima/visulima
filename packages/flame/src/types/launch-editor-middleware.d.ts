declare module "launch-editor-middleware" {
    import type { IncomingMessage, ServerResponse } from "http";

    type NextFunction = (err?: any) => void;

    const create: () => (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void;

    export default create;
}


