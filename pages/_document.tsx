import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <title>速码方舟AI软件</title>
        <meta name="application-name" content="速码方舟AI软件" />
        <meta name="apple-mobile-web-app-title" content="速码方舟AI" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}