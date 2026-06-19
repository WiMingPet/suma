import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumaai.app',
  appName: '速码方舟AI软件',
  webDir: 'out',
  
  ios: {
    contentInset: 'always',
    allowsLinkPreview: true,
    scrollEnabled: true,
  },
  
  android: {
    allowMixedContent: true,
  },

  // ✅ 添加 server 配置
  server: {
    // 允许在 App 内访问外部网络资源
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // 关键配置：允许所有外部网络请求
    allowNavigation: ['*'],
  },
};

export default config;