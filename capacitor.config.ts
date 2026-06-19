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

  // 👇 新增：开启 CapacitorHttp 插件，让 fetch 自动走原生请求
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;