/* eslint-disable @typescript-eslint/no-confusing-void-expression, func-style, jsdoc/lines-before-block, no-empty, sonarjs/no-nested-conditional, sonarjs/pseudo-random */
/**
 * incremental-rendering.tsx — ratatat port of Ink's incremental-rendering example
 *
 * Demonstrates high-frequency partial updates:
 *   - 3 progress bars updating at ~60fps
 *   - Live log panel: only 1-2 lines update per frame
 *   - Scrollable service list (↑↓ to navigate)
 *   - Clock + counter updating every second
 *
 * Run: node --import @oxc-node/core/register examples/incremental-rendering.tsx
 */
// @ts-nocheck
import { Box, Text } from "@visulima/tui";
import { render, useApp, useInput, useWindowSize } from "@visulima/tui/react";
import React, { useEffect, useState } from "react";

const SERVICES = [
    "Server Authentication Module - Handles JWT token validation, OAuth2 flows, and session management across distributed systems",
    "Database Connection Pool - Maintains persistent connections to PostgreSQL cluster with automatic failover and load balancing",
    "API Gateway Service - Routes incoming HTTP requests to microservices with rate limiting and request transformation",
    "User Profile Manager - Caches user data in Redis with write-through policy and invalidation strategies",
    "Payment Processing Engine - Integrates with Stripe, PayPal, and Square APIs for transaction processing",
    "Email Notification Queue - Processes outbound emails through SendGrid with retry logic and delivery tracking",
    "File Storage Handler - Manages S3 bucket operations with multipart uploads and CDN integration",
    "Search Indexer Service - Maintains Elasticsearch indices with real-time document updates and reindexing",
    "Metrics Aggregation Pipeline - Collects and processes telemetry data for Prometheus and Grafana dashboards",
    "WebSocket Connection Manager - Handles real-time bidirectional communication for chat and notifications",
    "Cache Invalidation Service - Coordinates distributed cache updates across Redis cluster nodes",
    "Background Job Processor - Executes async tasks via RabbitMQ with dead letter queue handling",
    "Session Store Manager - Persists user sessions in DynamoDB with TTL and cross-region replication",
    "Rate Limiter Module - Enforces API quotas using token bucket algorithm with Redis backend",
    "Content Delivery Network - Serves static assets through Cloudflare with edge caching and GZIP compression",
    "Logging Aggregator - Streams application logs to ELK stack with structured JSON formatting",
    "Health Check Monitor - Performs periodic service health checks with circuit breaker pattern implementation",
    "Configuration Manager - Loads environment-specific settings from Consul with hot reload capability",
    "Security Scanner Service - Runs automated vulnerability scans and dependency checks on deployed applications",
    "Backup Orchestrator - Schedules and executes automated database backups with encryption and versioning",
    "Load Balancer Controller - Manages NGINX upstream servers with health-based traffic distribution",
    "Container Orchestration - Coordinates Docker container lifecycle via Kubernetes with auto-scaling policies",
    "Message Bus Coordinator - Routes events through Apache Kafka topics with guaranteed delivery semantics",
    "Analytics Data Warehouse - Aggregates business metrics in Snowflake with incremental ETL processes",
    "API Documentation Service - Generates and serves OpenAPI specs with interactive Swagger UI",
    "Feature Flag Manager - Controls feature rollouts using LaunchDarkly with user targeting and percentage rollouts",
    "Audit Trail Logger - Records all user actions and system events for compliance and security analysis",
    "Image Processing Pipeline - Resizes and optimizes uploaded images using Sharp with multiple format outputs",
    "Geolocation Service - Resolves IP addresses to geographic coordinates using MaxMind GeoIP2 database",
    "Recommendation Engine - Generates personalized content suggestions using collaborative filtering algorithms",
];

const ACTIONS = ["PROCESSING", "COMPLETED", "UPDATING", "SYNCING", "VALIDATING", "EXECUTING"];

function generateLogLine(index: number) {
    const timestamp = new Date().toLocaleTimeString();
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const throughput = (Math.random() * 1000).toFixed(0);
    const memory = (Math.random() * 512).toFixed(1);
    const cpu = (Math.random() * 100).toFixed(1);

    return `[${timestamp}] Worker-${index} ${action}: Throughput=${throughput}req/s Mem=${memory}MB CPU=${cpu}%`;
}

function progressBar(value: number, width = 20) {
    const filled = Math.floor((value / 100) * width);

    return "█".repeat(filled) + "░".repeat(width - filled);
}

const IncrementalRendering = () => {
    const { exit } = useApp();
    const { columns, rows: termRows } = useWindowSize();

    // Layout: header(~9) + logs(~6) + footer(~3) + margins(~3) = ~21 fixed rows
    const available = Math.max(termRows - 21, 6);
    const logCount = Math.max(Math.floor(available * 0.3), 3);
    const serviceCount = Math.min(Math.max(Math.floor(available * 0.7), 5), SERVICES.length);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());
    const [counter, setCounter] = useState(0);
    const [fps, setFps] = useState(0);
    const [progress1, setProgress1] = useState(0);
    const [progress2, setProgress2] = useState(33);
    const [progress3, setProgress3] = useState(66);
    const [randomValue, setRandomValue] = useState(0);
    const [logLines, setLogLines] = useState(() => Array.from({ length: logCount }, (_, i) => generateLogLine(i)));

    // Clock + counter — 1s interval
    useEffect(() => {
        const t = setInterval(() => {
            setTimestamp(new Date().toLocaleTimeString());
            setCounter((c) => c + 1);
        }, 1000);

        return () => clearInterval(t);
    }, []);

    // High-frequency updates — ~60fps
    useEffect(() => {
        let frameCount = 0;
        let lastFpsTime = Date.now();
        let loopFrame = 0;

        const t = setInterval(() => {
            loopFrame++;
            setProgress1((p) => (p + 1) % 101);
            setProgress2((p) => (p + 2) % 101);
            setProgress3((p) => (p + 3) % 101);
            setRandomValue(Math.floor(Math.random() * 1000));

            // Only 1-2 log lines update per frame — simulates real incremental log output
            setLogLines((previous) => {
                const next = [...previous];
                const i = Math.floor(Math.random() * next.length);

                next[i] = generateLogLine(i);

                if (Math.random() > 0.5) {
                    const j = Math.floor(Math.random() * next.length);

                    next[j] = generateLogLine(j);
                }

                return next;
            });

            frameCount++;
            const now = Date.now();

            if (now - lastFpsTime >= 1000) {
                setFps(frameCount);
                frameCount = 0;
                lastFpsTime = now;
            }

            // Prevent perf_hooks buffer overflow
            if (loopFrame % 10_000 === 0) {
                try {
                    performance.clearMeasures();
                    performance.clearMarks();
                } catch {}
            }
        }, 16);

        return () => clearInterval(t);
    }, []);

    useInput((input, key) => {
        if (input === "q") {
            exit();
        }

        if (key.upArrow) {
            setSelectedIndex((i) => (i === 0 ? serviceCount - 1 : i - 1));
        }

        if (key.downArrow) {
            setSelectedIndex((i) => (i === serviceCount - 1 ? 0 : i + 1));
        }
    });

    const visibleServices = SERVICES.slice(0, serviceCount);

    return (
        <Box flexDirection="column" height={termRows} width={columns}>
            {/* Header */}
            <Box borderColor="cyan" borderStyle="round" flexShrink={0} paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Box flexDirection="row">
                        <Text bold color="cyan">
                            Incremental Rendering Demo
{" "}
                        </Text>
                        <Text dim>↑↓ navigate · Q quit · </Text>
                        <Text>
                            FPS:
{" "}
                            <Text bold color={fps >= 55 ? "green" : fps >= 30 ? "yellow" : "red"}>
                                {fps}
                            </Text>
                        </Text>
                    </Box>
                    <Box flexDirection="row" gap={3} marginTop={1}>
                        <Text>
                            Time:
{" "}
<Text color="green">{timestamp}</Text>
                        </Text>
                        <Text>
                            Updates:
{" "}
<Text color="yellow">{counter}</Text>
                        </Text>
                        <Text>
                            Rand:
{" "}
<Text color="cyan">{randomValue}</Text>
                        </Text>
                    </Box>
                    <Text>
                        P1:
{" "}
<Text color="green">{progressBar(progress1)}</Text>
{" "}
{String(progress1).padStart(3)}
%
                    </Text>
                    <Text>
                        P2:
{" "}
<Text color="yellow">{progressBar(progress2)}</Text>
{" "}
{String(progress2).padStart(3)}
%
                    </Text>
                    <Text>
                        P3:
{" "}
<Text color="red">{progressBar(progress3)}</Text>
{" "}
{String(progress3).padStart(3)}
%
                    </Text>
                </Box>
            </Box>

            {/* Live logs */}
            <Box borderColor="yellow" borderStyle="single" flexShrink={0} marginTop={1} paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Text bold color="yellow">
                        Live Logs
{" "}
<Text dim>(1-2 lines update per frame)</Text>
                    </Text>
                    {logLines.map((line, i) => (
                        <Text color="green" dim key={i}>
                            {line}
                        </Text>
                    ))}
                </Box>
            </Box>

            {/* Service list */}
            <Box borderColor="gray" borderStyle="single" flexGrow={1} marginTop={1} paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Text bold color="magenta">
                        System Services
{" "}
                        <Text dim>
                            (
{serviceCount}
{" "}
of
{" "}
{SERVICES.length}
)
                        </Text>
                    </Text>
                    {visibleServices.map((svc, i) => {
                        const selected = i === selectedIndex;

                        return (
                            <Text bold={selected} color={selected ? "cyan" : "white"} key={i}>
                                {selected ? "▶ " : "  "}
                                {svc}
                            </Text>
                        );
                    })}
                </Box>
            </Box>

            {/* Selected item footer */}
            <Box borderColor="magenta" borderStyle="round" flexShrink={0} marginTop={1} paddingX={2}>
                <Text dim>Selected: </Text>
                <Text bold color="magenta">
                    {visibleServices[selectedIndex]?.split(" - ")[0]}
                </Text>
                <Text dim>
{" "}
—
{visibleServices[selectedIndex]?.split(" - ")[1]}
                </Text>
            </Box>
        </Box>
    );
};

render(<IncrementalRendering />);
