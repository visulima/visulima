"use strict";

import { red, green, hex, visible, inverse } from "@visulima/colorize";

// defined a truecolor as the constant
const orange = hex("#FFAB40");

let cpu = 33;
let ram = 44;
let disk = 55;

// normal colors
console.log(visible`
CPU:  ${red`${cpu}%`}
RAM:  ${green`${ram}%`}
DISK: ${orange`${disk}%`}
`);

// inversed colors
console.log(inverse`
CPU:  ${red`${cpu}%`}
RAM:  ${green`${ram}%`}
DISK: ${orange`${disk}%`}
`);
