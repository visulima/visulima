import { pail } from "@visulima/pail";

pail.wrapConsole();

const scaryObject = {
    get value() {
        console.warn("Do not access me!", scaryObject);
    },
};

pail.log(scaryObject);
