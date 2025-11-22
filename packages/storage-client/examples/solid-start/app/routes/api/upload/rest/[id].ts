import { createSolidStartHandler } from "@visulima/storage/handler/http/solid-start";
import { storage } from "../../../../../lib/storage";

const handler = createSolidStartHandler({ storage, type: "rest" });

export const PUT = handler;
export const PATCH = handler;
export const GET = handler;
export const HEAD = handler;
export const DELETE = handler;
export const OPTIONS = handler;


