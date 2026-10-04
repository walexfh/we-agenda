import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.we.agenda',
  appName: 'W&E Agenda',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
