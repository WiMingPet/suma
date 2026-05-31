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
};

export default config;