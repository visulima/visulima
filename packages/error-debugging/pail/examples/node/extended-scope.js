import { pail } from "@visulima/pail";

console.log("\n");

const global = pail.scope("global scope");

global.success("Hello from the global scope");

function foo() {
    const outer = global.scope("outer", "scope");
    outer.success("Hello from the outer scope");

    setTimeout(() => {
        const inner = outer.scope("inner", "scope");
        inner.success("Hello from the inner scope");
    }, 500);
}

foo();
