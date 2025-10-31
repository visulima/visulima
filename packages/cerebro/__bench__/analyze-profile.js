// packages/cerebro/__bench__/analyze-profile.js
import { readFileSync } from "node:fs";

const profileFile = process.argv[2] || "CPU.20251026.165538.3777188.0.001.cpuprofile";
const profile = JSON.parse(readFileSync(profileFile, "utf8"));

// Extract functions and their hit counts
const functionHits = new Map();
const functionInfo = new Map();

// Build function info map
for (const node of profile.nodes) {
    const functionName = node.callFrame.functionName || "(anonymous)";
    const url = node.callFrame.url || "";
    const lineNumber = node.callFrame.lineNumber || 0;

    functionInfo.set(node.id, {
        hitCount: node.hitCount || 0,
        lineNumber,
        name: functionName,
        url,
    });
}

// Aggregate hits by function
for (const [id, info] of functionInfo) {
    const key = `${info.name} (${info.url}:${info.lineNumber})`;
    const current = functionHits.get(key) || 0;

    functionHits.set(key, current + info.hitCount);
}

// Sort by hit count and display top 30
const sorted = [...functionHits.entries()]
    .filter(([_, hits]) => hits > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

console.log("\n=== Top 30 Functions by CPU Time ===\n");
let totalHits = 0;

for (const [_, hits] of functionHits) {
    totalHits += hits;
}

for (const [function_, hits] of sorted) {
    const percentage = ((hits / totalHits) * 100).toFixed(2);

    console.log(`${percentage}% (${hits} samples): ${function_}`);
}

console.log(`\nTotal samples: ${totalHits}`);

