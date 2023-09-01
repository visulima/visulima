import { getSwaggerStaticProps as getSwaggerStaticProperties } from "@visulima/api-platform/framework/next";
import SwaggerPage from "@visulima/api-platform/framework/next/pages/swagger";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
