/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "false", load points via pain-server GET /init/:layer (production path). */
  readonly VITE_USE_MOCK_API?: string;
  /** Optional absolute API origin (e.g. https://staging.example.com). Empty = same-origin. */
  readonly VITE_PAIN_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
