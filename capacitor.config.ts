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

  // ✅ 开启原生拦截，让标准 fetch 自动走原生网络通道
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;