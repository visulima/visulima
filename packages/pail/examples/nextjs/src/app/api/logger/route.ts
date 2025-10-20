import { NextRequest, NextResponse } from "next/server";
import { createPail } from "@visulima/pail";

// Create a logger specifically for edge runtime
const edgeLogger = createPail({
    scope: "edge-api",
});

export const runtime = "edge";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get("message") || "Hello from Edge Runtime!";
    const level = searchParams.get("level") || "info";

    try {
        // Log the incoming request
        edgeLogger.info("Edge API request received", {
            method: request.method,
            url: request.url,
            userAgent: request.headers.get("user-agent"),
            timestamp: new Date().toISOString(),
        });

        // Log based on the requested level
        switch (level) {
            case "error":
                edgeLogger.error(message, { level: "error" });
                break;
            case "warn":
                edgeLogger.warn(message, { level: "warn" });
                break;
            case "debug":
                edgeLogger.debug(message, { level: "debug" });
                break;
            case "success":
                edgeLogger.success(message, { level: "success" });
                break;
            default:
                edgeLogger.info(message, { level: "info" });
        }

        // Simulate some processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        edgeLogger.success("Edge API request processed successfully");

        return NextResponse.json({
            success: true,
            message: `Logged: ${message}`,
            level,
            runtime: "edge",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        edgeLogger.error("Edge API request failed", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to process request",
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        edgeLogger.info("Edge API POST request", {
            body,
            method: request.method,
            url: request.url,
        });

        // Log the data that was posted
        edgeLogger.success("Data received and logged", {
            dataKeys: Object.keys(body),
            dataSize: JSON.stringify(body).length,
        });

        return NextResponse.json({
            success: true,
            message: "Data logged successfully",
            loggedKeys: Object.keys(body),
            runtime: "edge",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        edgeLogger.error("Edge API POST request failed", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to process POST request",
                timestamp: new Date().toISOString(),
            },
            { status: 400 },
        );
    }
}
