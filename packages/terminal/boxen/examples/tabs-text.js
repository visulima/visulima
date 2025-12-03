import { boxen } from "@visulima/boxen";

console.log("\n----------- Box with tabs text -----------");

const formattedText = `
!!!  Unicorns are lit !!!
Hello this is a formatted text !
				It has alignements
				already includes${" "}
				in it.${" "}
Boxen should protect this alignement,
		otherwise the users would be sad !
Hehe          Haha${" ".repeat(33)}
Hihi       Hoho
	All this garbage is on purpose.
Have a good day !
`;

console.log(boxen(formattedText));
