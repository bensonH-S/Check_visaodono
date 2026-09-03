/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __BUILD_VERSION__: string;
declare const __BUILD_ID__: string;

declare module '*?worker&url' {
  const url: string;
  export default url;
}
