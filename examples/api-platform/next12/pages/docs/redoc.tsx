import { getSwaggerStaticProps as getSwaggerStaticProperties } from "@visulima/api-platform/next";
import RedocPage from "@visulima/api-platform/next/pages/redoc";

export const getStaticProps = getSwaggerStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default RedocPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
