import { createPail } from "@visulima/pail";

console.log("\n");

const interactive = createPail({ interactive: true });

const TICKS = 60;
const TIMEOUT = 80;
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const messages = ["Swapping time and space...", "Have a good day.", "Don't panic...", "Updating Updater...", "42"];
let ticks = TICKS;
let i = 0;

const interactiveManager = interactive.getInteractiveManager();

interactiveManager.hook();

interactive.log(" - log message");
interactive.error(" - error message");
interactive.warn(" - warn message");

const id = setInterval(() => {
    if (--ticks < 0) {
        clearInterval(id);

        interactiveManager.update("stdout", ["✔ Success", "", "Messages:", "this line is be deleted!!!"]);
        interactiveManager.erase("stdout", 1);
        interactiveManager.unhook(false);
    } else {
        const frame = frames[(i = ++i % frames.length)];
        const index = Math.round(ticks / 10) % messages.length;
        const message = messages[index];

        if (message) {
            interactiveManager.update("stdout", [`${frame} Some process...`, message]);
        }
    }
}, TIMEOUT);
