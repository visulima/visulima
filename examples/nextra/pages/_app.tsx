import '../styles/style.css'

import "@visulima/nextra-theme-docs/style.css";

import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
