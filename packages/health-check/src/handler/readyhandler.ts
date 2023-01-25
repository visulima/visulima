import { StatusCodes } from "http-status-codes";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { HealthCheck } from "../types";

// eslint-disable-next-line max-len
export default <Request extends IncomingMessage, Response extends ServerResponse>(healthCheck: HealthCheck) => async (_request: Request, response: Response): Promise<void> => {
    const { healthy } = await healthCheck.getReport();

    response.statusCode = healthy ? StatusCodes.NO_CONTENT : StatusCodes.SERVICE_UNAVAILABLE;
    response.end();
};
