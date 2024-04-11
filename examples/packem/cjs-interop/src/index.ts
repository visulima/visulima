const test = () => {
    return "this should be in final bundle, test function";
};

// const test2 = "this should be in final bundle, test2 string";
//
// export type Test4 = {
//     test: typeof test;
//     test2: typeof test2;
// };
//
// export { test2, test as default };

export default test;
