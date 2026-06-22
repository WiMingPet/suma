/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.BUILD_FOR_IOS === 'true' ? 'export' : undefined,
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  compress: false, // ✅ 关键：禁用压缩
  env: {
    NEXT_PUBLIC_APP_NAME: '速码方舟AI软件',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

module.exports = nextConfig;