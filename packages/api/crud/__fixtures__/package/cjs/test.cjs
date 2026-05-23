const pkg = require("@visulima/crud");

if (typeof pkg !== "object" || pkg === null) {
    throw new Error("expected exports to be an object");
}

if (Object.keys(pkg).length === 0) {
    throw new Error("expected non-empty exports");
}

console.log("ok");
