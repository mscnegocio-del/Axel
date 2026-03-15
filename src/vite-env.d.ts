/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_UPGRADE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
