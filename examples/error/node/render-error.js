import {greenBright, cyan, red, green} from "@visulima/colorize";
import { renderError, VisulimaError } from "@visulima/error";

console.log("------------------ ERROR ------------------");
console.log(renderError(new Error("This is an error message")));

console.log("\n------------------ ERROR WITH CAUSE ------------------");
console.log(
    renderError(
        new Error("This is an error message", {
            cause: new Error("This is the cause of the error"),
        }),
    ),
);

console.log("\n------------------ ERROR WITH HINT ------------------");
console.log(
    renderError(
        new VisulimaError({
            name: "DatabaseError",
            message: "This is an error message",
            hint: [
                'We tried looking for using inside the "users" table',
                "The search was performed using the where (email = user.email) and (is_active = true)",
            ],
        }),
    ),
);

console.log("\n------------------ ERROR WITH HINT, CAUSE and COLOR ------------------");
console.log(
    renderError(
        new VisulimaError({
            name: "DatabaseError",
            message: "This is an error message",
            hint: [
                'We tried looking for using inside the "users" table',
                "The search was performed using the where (email = user.email) and (is_active = true)",
            ],
            cause: new Error("This is the cause of the error"),
        }),
        {
            color: {
                title: red,
                hint: cyan,
                message: red,
                marker: red,
                method: greenBright,
                fileLine: green
            },
        },
    ),
);
