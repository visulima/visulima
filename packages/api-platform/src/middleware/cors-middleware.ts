import { expressWrapper } from "@visulima/connect";
import type { CorsOptions, CorsOptionsDelegate } from "cors";
import cors from "cors";
import { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line max-len
const corsMiddleware = <Request extends IncomingMessage, Response extends ServerResponse>(options?: CorsOptions | CorsOptionsDelegate) => expressWrapper<Request, Response>(cors(options));

export default corsMiddleware;
