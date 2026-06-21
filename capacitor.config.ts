import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumaai.app',
  appName: '速码方舟AI软件',
  webDir: 'out',
  
  ios: {
    contentInset: 'always',
    allowsLinkPreview: true,
    scrollEnabled: true,
    // 允许访问你的 API 域名
    limitsNavigationsToAppBoundDomains: true,
  },
  
  android: {
    allowMixedContent: true,
  },

  server: {
    // 生产模式用本地文件加载
    url: undefined,
    // 允许导航到你的域名
    allowNavigation: ['sumaai.cn'],
  },

  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    // 如果用了 Capacitor Browser，配置入口域名
    CapacitorBrowser: {
      enabled: true,
    },
  },
};

export default config;