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
};
