// eslint-disable-next-line import/no-extraneous-dependencies
import createHttpError from "http-errors";
import type { NextApiRequest, NextApiResponse } from "next";
import type { IncomingMessage, ServerResponse } from "node:http";

import Multipart from "../handler/multipart";
import Tus from "../handler/tus";
import type { UploadOptions } from "../handler/types";
import type { UploadFile } from "../storage/utils/file";

export const nodeTusHandler = <TFile extends UploadFile, Request extends IncomingMessage = NextApiRequest, Response extends ServerResponse = NextApiResponse>(
    options: UploadOptions<TFile>,
) => {
    const tus = new Tus<TFile, Request, Response>(options);

    return (request: Request, response: Response) => {
        if (typeof (request as any).body === undefined) {
            throw createHttpError(400, "Please disable the bodyParser, check https://nextjs.org/docs/api-routes/request-helpers how to do it.");
        }

        return tus.handle(request, response);
    };
};

export const nodeMultipartHandler = <
    TFile extends UploadFile,
    Request extends IncomingMessage = NextApiRequest,
    Response extends ServerResponse = NextApiResponse,
>(
        options: UploadOptions<TFile>,
    ) => {
    const multipart = new Multipart<TFile, Request, Response>(options);

    return (request: Request, response: Response) => {
        if (typeof (request as any).body === undefined) {
            throw createHttpError(400, "Please disable the bodyParser, check https://nextjs.org/docs/api-routes/request-helpers how to do it.");
        }

        return multipart.handle(request, response);
    };
};
