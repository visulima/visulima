import { createHandler } from "@visulima/storage/handler/http/nextjs";

import { storage } from "../../../../lib/storage";

const handler = createHandler({ storage, type: "tus" });

export const POST = handler;
export const PATCH = handler;
export const HEAD = handler;
export const DELETE = handler;
export const OPTIONS = handler;
