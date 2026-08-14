import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aimaven.ledgerpro',
  appName: 'LedgerPro',
  webDir: 'out',
  server: {
    androidScheme: 'http',
  },
};

export default config;
