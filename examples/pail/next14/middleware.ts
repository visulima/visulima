import { createPail } from "@visulima/pail";
import { PrettyReporter } from "@visulima/pail/reporter/pretty";
import { NextResponse } from "next/server";

const pail = createPail({
    reporters: [new PrettyReporter()],
});

export async function middleware(): Promise<NextResponse> {
    const response = NextResponse.next();

    pail.info("pail colors works! :)", {
        label: "pail",
        groups: ["pail", "colors"],
    });

    return response;
}
