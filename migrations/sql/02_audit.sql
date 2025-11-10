-- sql/02_audit.sql
CREATE SCHEMA IF NOT EXISTS audit;


CREATE TABLE IF NOT EXISTS audit.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    op text NOT NULL CHECK (op IN ('I','U','D')),
    row_pk jsonb,
    row_before jsonb,
    row_after jsonb,
    actor text, -- user/app id propagado por header o contexto
    trace_id text, -- correlación
    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION audit.if_modified_func()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_pk jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_pk := to_jsonb(NEW) - ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = TG_RELID AND a.attisdropped = false AND a.attnum > 0 AND a.attname NOT IN ('id'));
        INSERT INTO audit.audit_log(table_name, op, row_pk, row_before, row_after, actor, trace_id)
        VALUES (TG_TABLE_NAME, 'I', v_pk, NULL, to_jsonb(NEW), current_setting('app.actor', true), current_setting('app.trace_id', true));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_pk := jsonb_build_object('id', NEW.id);
        INSERT INTO audit.audit_log(table_name, op, row_pk, row_before, row_after, actor, trace_id)
        VALUES (TG_TABLE_NAME, 'U', v_pk, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.actor', true), current_setting('app.trace_id', true));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        v_pk := jsonb_build_object('id', OLD.id);
        INSERT INTO audit.audit_log(table_name, op, row_pk, row_before, row_after, actor, trace_id)
        VALUES (TG_TABLE_NAME, 'D', v_pk, to_jsonb(OLD), NULL, current_setting('app.actor', true), current_setting('app.trace_id', true));
        RETURN OLD;
    END IF;
END;$$;


-- Para cada tabla de dominio: CREATE TRIGGER ... BEFORE INSERT OR UPDATE OR DELETE
-- EXECUTE FUNCTION audit.if_modified_func();