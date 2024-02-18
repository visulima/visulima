import { pail } from "@visulima/pail";

console.log("------------------ TIME ------------------");

pail.time("test");
pail.time();
pail.time();

setTimeout(() => {
  pail.timeEnd();
  pail.timeEnd();
  pail.timeEnd("test");
}, 500);
