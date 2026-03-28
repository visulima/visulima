import { useContext } from "react";

import type { Props, PublicProps } from "../components/StdinContext";
import StdinContext from "../components/StdinContext";

/**
 * A React hook that returns the stdin stream and stdin-related utilities.
 */
const useStdin = (): PublicProps => useContext(StdinContext);

export const useStdinContext = (): Props => useContext(StdinContext);

export default useStdin;
