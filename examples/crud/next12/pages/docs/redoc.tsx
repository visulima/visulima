import { getOpenapiStaticProps as getOpenapiStaticProperties } from "@visulima/api-platform/framework/next";
import RedocPage from "@visulima/api-platform/framework/next/pages/redoc";

export const getStaticProps = getOpenapiStaticProperties(`${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/swagger`);

export default RedocPage(`${process.env.NEXT_PUBLIC_APP_NAME} swagger`);
