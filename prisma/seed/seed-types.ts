export interface SeedContext {
  say: (message: string) => void;
  tally: {
    created: number;
    skipped: number;
  };
}

export interface SeedModule {
  /** Unique, stable name used for logs and diagnostics. */
  name: string;

  /** Lower numbers execute first. */
  order?: number;

  /** Optional modules can be disabled through configuration. */
  enabled?: boolean;

  /** Run this seed. */
  run: (context: SeedContext) => Promise<void>;
}
