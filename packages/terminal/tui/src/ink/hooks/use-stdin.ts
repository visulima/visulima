import { useContext } from "react";

import type { Props, PublicProps } from "../components/StdinContext.js";
import StdinContext from "../components/StdinContext.js";

/**
 * A React hook that returns the stdin stream and stdin-related utilities.
 */
const useStdin = (): PublicProps => useContext(StdinContext);

export const useStdinContext = (): Props => useContext(StdinContext);

export default useStdin;
