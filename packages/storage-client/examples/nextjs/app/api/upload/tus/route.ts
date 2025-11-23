import { createHandler } from "@visulima/storage/handler/http/nextjs";

import { storage } from "../../../../lib/storage";

const handler = createHandler({ storage, type: "tus" });

export const POST = handler;
export const OPTIONS = handler;
