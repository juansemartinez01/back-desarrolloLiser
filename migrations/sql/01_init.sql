-- sql/01_init.sql
-- Timezone y settings recomendados
ALTER DATABASE core SET timezone TO 'UTC';
ALTER DATABASE core SET lock_timeout TO '5s';
ALTER DATABASE core SET statement_timeout TO '30s';
ALTER DATABASE core SET idle_in_transaction_session_timeout TO '15s';


-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gin; -- índices compuestos
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- Convenciones
-- * snake_case
-- * claves primarias: uuid v4 (o v7 a nivel app) / bigint identity
-- * timestamps: created_at, updated_at (UTC), deleted_at (soft delete opcional)