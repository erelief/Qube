import pkg from './package.json';

const host = process.env.TAURI_DEV_HOST;

export default {
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 5175 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_ICON__: JSON.stringify('/images/logo.png'),
    __ABOUT_DEPS__: JSON.stringify([
      { name: 'Tauri', version: pkg.dependencies['@tauri-apps/api'], url: 'https://tauri.app' },
      { name: 'Three.js', version: pkg.dependencies['three'], url: 'https://threejs.org' },
      { name: 'Lucide', url: 'https://lucide.dev' },
    ]),
  },
};
