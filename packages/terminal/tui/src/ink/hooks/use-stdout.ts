import { useContext } from "react";

import type { Props } from "../components/StdoutContext";
import StdoutContext from "../components/StdoutContext";

/**
 * A React hook that returns the stdout stream where Ink renders your app.
 */
const useStdout = (): Props => useContext(StdoutContext);

export default useStdout;
