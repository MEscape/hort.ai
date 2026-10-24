# Configuration Rules

- Treat environment variables as infrastructure/configuration concerns.
- Validate configuration at startup. See [validation.md](validation.md).
- Keep server-only configuration in @lib/config/server, which imports server-only. Keep browser-safe values in @lib/config.
- Require subsystem configuration only when that subsystem is enabled; database configuration is always required.
- Production requires authentication and a shared rate-limit store secured by a secret of at least 32 characters.
- Object storage defaults to STORAGE_PROVIDER=none. For s3, require its credentials and buckets. Reject settings for unselected providers. In production, require HTTPS for the storage endpoint and public origin.
- Use NEXT_PUBLIC_* only for intentionally public values; never expose secrets through this prefix. See [security.md](security.md).
- Centralize environment access behind typed configuration. Do not access process.env throughout application code.
- Do not hard-code environment-specific behavior.
- Fail fast when required configuration is missing.
- Never commit secrets or credentials.
