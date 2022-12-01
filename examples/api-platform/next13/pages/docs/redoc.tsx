import { getSwaggerStaticProps as getSwaggerStaticProperties, RedocPage } from "@visulima/api-platform/next";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default RedocPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
