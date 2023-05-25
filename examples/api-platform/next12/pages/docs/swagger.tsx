import { getSwaggerStaticProps } from "@visulima/api-platform/next";
import SwaggerPage from "@visulima/api-platform/next/pages/swagger";

export const getStaticProps = getSwaggerStaticProps(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default SwaggerPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
