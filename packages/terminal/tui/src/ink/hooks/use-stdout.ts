import { useContext } from "react";

import type { Props } from "../../components/stdout-context";
import StdoutContext from "../../components/stdout-context";

/**
 * A React hook that returns the stdout stream where Ink renders your app.
 */
const useStdout = (): Props => useContext(StdoutContext);

export default useStdout;

export { useStdout };
