/** @type {import('next').NextConfig} */
const nextConfig = {
  // 只在打包 iOS 时启用静态导出
  output: process.env.BUILD_FOR_IOS === 'true' ? 'export' : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_NAME: '速码方舟AI软件',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

module.exports = nextConfig;