import { useContext } from "react";

import type { Props, PublicProps } from "../../components/stdin-context";
import StdinContext from "../../components/stdin-context";

/**
 * A React hook that returns the stdin stream and stdin-related utilities.
 */
const useStdin = (): PublicProps => useContext(StdinContext);

export const useStdinContext = (): Props => useContext(StdinContext);

export default useStdin;

export { useStdin };
export type { PublicProps as StdinProps } from "../../components/stdin-context";
