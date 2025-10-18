"use client";

import { useState } from "react";

export default function Home() {
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const logMessage = async (level: string, message?: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/logger?level=${level}${message ? `&message=${encodeURIComponent(message)}` : ""}`);
            const data = await res.json();
            setResponse(data);
        } catch (error) {
            setResponse({ error: "Failed to call API" });
        } finally {
            setLoading(false);
        }
    };

    const sendData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/logger", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    user: "nextjs-user",
                    action: "test-edge-logging",
                    timestamp: new Date().toISOString(),
                    metadata: {
                        browser: "Next.js Client",
                        version: "15.x",
                    },
                }),
            });
            const data = await res.json();
            setResponse(data);
        } catch (error) {
            setResponse({ error: "Failed to send data" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="font-sans min-h-screen p-8">
            <main className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-4">Pail Edge Runtime Demo</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">Test logging functionality in Next.js Edge Runtime</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Check your terminal/console for Pail logs from the Edge API routes</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold mb-4">Log Levels</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => logMessage("info", "Hello from Edge Runtime!")}
                                disabled={loading}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                            >
                                Info Log
                            </button>
                            <button
                                onClick={() => logMessage("success", "Operation completed successfully!")}
                                disabled={loading}
                                className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                            >
                                Success Log
                            </button>
                            <button
                                onClick={() => logMessage("warn", "This is a warning message")}
                                disabled={loading}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                            >
                                Warning Log
                            </button>
                            <button
                                onClick={() => logMessage("error", "Something went wrong!")}
                                disabled={loading}
                                className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                            >
                                Error Log
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold mb-4">POST Data</h2>
                        <button
                            onClick={sendData}
                            disabled={loading}
                            className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded w-full disabled:opacity-50"
                        >
                            Send Test Data
                        </button>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Sends structured data to the Edge API for logging</p>
                    </div>
                </div>

                <div className="mt-8">
                    <h2 className="text-2xl font-semibold mb-4">API Response</h2>
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg min-h-[200px]">
                        {loading ? (
                            <p className="text-gray-500">Loading...</p>
                        ) : response ? (
                            <pre className="text-sm overflow-auto">{JSON.stringify(response, null, 2)}</pre>
                        ) : (
                            <p className="text-gray-500">Click a button above to test the Edge API</p>
                        )}
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Edge Runtime Features</h3>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                            <li>• Runs on Vercel Edge Network or Cloudflare Workers</li>
                            <li>• Uses browser-compatible Pail reporters</li>
                            <li>• Fast cold start times</li>
                            <li>• Global distribution</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}
