import { getSwaggerStaticProps as getSwaggerStaticProperties, SwaggerPage } from "@visulima/api-platform";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`, <div>@todo: use mui component...</div>);
