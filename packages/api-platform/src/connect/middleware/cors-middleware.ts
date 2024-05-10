import type { IncomingMessage, ServerResponse } from "node:http";

import { expressWrapper } from "@visulima/connect";
import type { CorsOptions, CorsOptionsDelegate } from "cors";
import cors from "cors";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const corsMiddleware = <Request extends IncomingMessage, Response extends ServerResponse>(options?: CorsOptions | CorsOptionsDelegate) =>
    expressWrapper<Request, Response>(cors(options));

export default corsMiddleware;
