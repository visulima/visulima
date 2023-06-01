import { getSwaggerStaticProps, SwaggerPage } from "../../../../packages/api-platform/framework/next";

export const getStaticProps = getSwaggerStaticProps(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
