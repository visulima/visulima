import { renderObjectTree } from "./dist/index.server.js";

const object = { name: "test", value: 42 };

console.log("Testing basic functionality:");
console.log(renderObjectTree(object));
console.log("Test passed!");
