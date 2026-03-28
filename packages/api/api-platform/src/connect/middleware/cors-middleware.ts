import type { IncomingMessage, ServerResponse } from "node:http";

import type { Nextable, NodeRequestHandler } from "@visulima/connect";
import { expressWrapper } from "@visulima/connect";
import cors from "cors";
import type CorsTypes from "cors";

const corsMiddleware = <Request extends IncomingMessage, Response extends ServerResponse>(options?: CorsTypes.CorsOptions | CorsTypes.CorsOptionsDelegate): Nextable<NodeRequestHandler<Request, Response>> =>
    expressWrapper<Request, Response>(cors(options));

export default corsMiddleware;
