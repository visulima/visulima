import { expressWrapper } from "@visulima/connect";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { CorsOptions, CorsOptionsDelegate } from "cors";
// eslint-disable-next-line import/no-extraneous-dependencies
import cors from "cors";
import type { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line max-len
const corsMiddleware = <Request extends IncomingMessage, Response extends ServerResponse>(options?: CorsOptions | CorsOptionsDelegate) => expressWrapper<Request, Response>(cors(options));

export default corsMiddleware;
