declare namespace NodeJS {
  interface ProcessEnv {
    /** Set by Next.js itself to the runtime the code is compiled for; the only variable read outside `@lib/config`. */
    readonly NEXT_RUNTIME?: 'nodejs' | 'edge';
  }
}
