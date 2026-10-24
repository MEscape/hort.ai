#!/usr/bin/env bash

set -euo pipefail

: "${AUTH_DATABASE_NAME:?AUTH_DATABASE_NAME must be set}"

echo "Creating auth database: ${AUTH_DATABASE_NAME}"

psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=auth_database_name="${AUTH_DATABASE_NAME}" \
  <<'SQL'
SELECT format('CREATE DATABASE %I', :'auth_database_name')
WHERE NOT EXISTS (
    SELECT FROM pg_database
    WHERE datname = :'auth_database_name'
)\gexec
SQL
