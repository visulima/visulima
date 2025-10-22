/**
 * Object Tree Example
 *
 * This example demonstrates how to use the renderObjectTree function
 * to visualize JavaScript objects as ASCII trees. It shows:
 * - Basic object rendering
 * - Custom styling options
 * - Nested object structures
 * - Custom render functions
 * - Circular reference handling
 */

import { renderObjectTree } from "@visulima/pail";

console.log("=== Basic Object Tree ===");
const user = {
    name: "Alice Johnson",
    age: 28,
    email: "alice@example.com",
    active: true,
};

console.log(renderObjectTree(user));
console.log("\n");

console.log("=== Nested Object Structure ===");
const config = {
    server: {
        host: "localhost",
        port: 3000,
        ssl: {
            enabled: true,
            cert: "/path/to/cert.pem",
            key: "/path/to/key.pem",
        },
    },
    database: {
        type: "postgresql",
        connection: {
            host: "db.example.com",
            port: 5432,
            database: "myapp",
        },
    },
    features: {
        authentication: true,
        fileUploads: false,
        notifications: {
            email: true,
            sms: false,
            push: true,
        },
    },
};

console.log(renderObjectTree(config));
console.log("\n");

console.log("=== Custom Styling ===");
const data = {
    project: "MyApp",
    version: "2.1.0",
    contributors: 15,
    stars: 1250,
};

console.log("Default style:");
console.log(renderObjectTree(data));

console.log("\nCustom style:");
console.log(
    renderObjectTree(data, {
        keyNeighbour: "├── ",
        keyNoNeighbour: "└── ",
        separator: " → ",
        spacerNeighbour: "│  ",
        spacerNoNeighbour: "   ",
    }),
);
console.log("\n");

console.log("=== Custom Render Function ===");
const metrics = {
    responseTime: 145, // milliseconds
    errorRate: 0.02, // percentage
    uptime: 99.9, // percentage
    requestsPerSecond: 1250,
};

console.log("Default rendering:");
console.log(renderObjectTree(metrics));

console.log("\nWith custom formatting:");
console.log(
    renderObjectTree(metrics, {
        renderFn: (node) => {
            if (typeof node === "number") {
                if (node < 1) {
                    return `${(node * 100).toFixed(2)}%`;
                }
                if (node > 1000) {
                    return `${(node / 1000).toFixed(1)}k`;
                }
                return node.toString();
            }
            return ["boolean", "string"].includes(typeof node) ? String(node) : undefined;
        },
    }),
);
console.log("\n");

console.log("=== Alphabetical Sorting ===");
const unsorted = {
    zebra: "animal",
    apple: "fruit",
    banana: "fruit",
    car: "vehicle",
};

console.log("Default order (reverse insertion):");
console.log(renderObjectTree(unsorted));

console.log("\nAlphabetically sorted:");
console.log(
    renderObjectTree(unsorted, {
        sortFn: (a, b) => a.localeCompare(b),
    }),
);
console.log("\n");

console.log("=== Circular Reference Handling ===");
const circularObj = {
    name: "Circular Example",
    data: [1, 2, 3],
};

// Create circular reference
circularObj.self = circularObj;

console.log("With circular reference detection:");
console.log(renderObjectTree(circularObj));

console.log("\nWith custom circular reference message:");
console.log(
    renderObjectTree(circularObj, {
        breakCircularWith: " [↻ CIRCULAR]",
    }),
);
console.log("\n");

console.log("=== Complex Real-World Example ===");
const packageInfo = {
    name: "@visulima/pail",
    version: "3.0.1",
    description: "Highly configurable Logger for Node.js, Edge and Browser",
    keywords: ["logger", "console", "terminal", "colors"],
    repository: {
        type: "git",
        url: "https://github.com/visulima/visulima",
        directory: "packages/pail",
    },
    author: {
        name: "Daniel Bannert",
        email: "d.bannert@anolilab.de",
        url: "https://danielbannert.com",
    },
    engines: {
        node: ">=20.19 <=25.x",
    },
    dependencies: {
        "@visulima/colorize": "^1.4.25",
        "type-fest": "^5.1.0",
    },
    devDependencies: {
        "@visulima/error": "^5.0.2",
        "@visulima/fmt": "^1.1.17",
        vitest: "^3.2.4",
    },
};

console.log("Package information tree:");
console.log(
    renderObjectTree(packageInfo, {
        sortFn: (a, b) => a.localeCompare(b), // Alphabetical sorting
    }),
);
console.log("\n");

console.log("=== Array-like Output ===");
const simpleObj = {
    method: "GET",
    status: 200,
    cached: false,
};

const lines = renderObjectTree(simpleObj, { joined: false });
console.log("As array of lines:");
lines.forEach((line, index) => {
    console.log(`${index + 1}: ${line}`);
});
