import { getSwaggerStaticProps, SwaggerPage } from "@visulima/api-platform/next";

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`, <div>@todo: use mui component...</div>);
export const getStaticProps = getSwaggerStaticProps(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);
