import type { ComponentProps, ReactElement } from "react";

import { cn } from "../utils";

// eslint-disable-next-line react/jsx-props-no-spreading,max-len,react/destructuring-assignment
const Table = ({ className = "", ...properties }: ComponentProps<"table">): ReactElement => <table className={cn("block overflow-scroll", className)} {...properties} />;

export default Table;
