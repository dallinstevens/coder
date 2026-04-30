-- name: GetUserSecretByUserIDAndName :one
SELECT *
FROM user_secrets
WHERE user_id = @user_id AND name = @name;

-- name: GetUserSecretByID :one
SELECT *
FROM user_secrets
WHERE id = @id;

-- name: ListUserSecrets :many
-- Returns metadata only (no value or value_key_id) for the
-- REST API list and get endpoints.
SELECT
    id, user_id, name, description,
    env_name, file_path,
    created_at, updated_at
FROM user_secrets
WHERE user_id = @user_id
ORDER BY name ASC;

-- name: ListUserSecretsWithValues :many
-- Returns all columns including the secret value. Used by the
-- provisioner (build-time injection) and the agent manifest
-- (runtime injection).
SELECT *
FROM user_secrets
WHERE user_id = @user_id
ORDER BY name ASC;

-- name: CreateUserSecret :one
INSERT INTO user_secrets (
    id,
    user_id,
    name,
    description,
    value,
    value_key_id,
    env_name,
    file_path
) VALUES (
    @id,
    @user_id,
    @name,
    @description,
    @value,
    @value_key_id,
    @env_name,
    @file_path
) RETURNING *;

-- name: UpdateUserSecretByUserIDAndName :one
UPDATE user_secrets
SET
    value       = CASE WHEN @update_value::bool THEN @value ELSE value END,
    value_key_id = CASE WHEN @update_value::bool THEN @value_key_id ELSE value_key_id END,
    description = CASE WHEN @update_description::bool THEN @description ELSE description END,
    env_name    = CASE WHEN @update_env_name::bool THEN @env_name ELSE env_name END,
    file_path   = CASE WHEN @update_file_path::bool THEN @file_path ELSE file_path END,
    updated_at  = CURRENT_TIMESTAMP
WHERE user_id = @user_id AND name = @name
RETURNING *;

-- name: DeleteUserSecretByUserIDAndName :one
DELETE FROM user_secrets
WHERE user_id = @user_id AND name = @name
RETURNING *;

-- name: GetUserSecretsTelemetrySummary :one
-- Returns deployment-wide aggregates for the telemetry snapshot.
-- Counts of secrets grouped by which injection fields are populated,
-- and the distribution of secrets per user computed across users
-- with at least one secret. Percentiles use percentile_disc so they
-- return an integer count from the underlying values rather than
-- interpolating between rows.
WITH per_user AS (
    SELECT user_id, COUNT(*)::bigint AS n
    FROM user_secrets
    GROUP BY user_id
)
SELECT
    COUNT(DISTINCT user_id)::bigint                                    AS users_with_secrets,
    COUNT(*)::bigint                                                   AS total_secrets,
    COUNT(*) FILTER (WHERE env_name != '' AND file_path = '' )::bigint AS env_name_only,
    COUNT(*) FILTER (WHERE env_name = ''  AND file_path != '')::bigint AS file_path_only,
    COUNT(*) FILTER (WHERE env_name != '' AND file_path != '')::bigint AS both,
    COUNT(*) FILTER (WHERE env_name = ''  AND file_path = '' )::bigint AS neither,
    COALESCE((SELECT MAX(n) FROM per_user), 0)::bigint                                                  AS secrets_per_user_max,
    COALESCE((SELECT percentile_disc(0.25) WITHIN GROUP (ORDER BY n) FROM per_user), 0)::bigint         AS secrets_per_user_p25,
    COALESCE((SELECT percentile_disc(0.50) WITHIN GROUP (ORDER BY n) FROM per_user), 0)::bigint         AS secrets_per_user_p50,
    COALESCE((SELECT percentile_disc(0.75) WITHIN GROUP (ORDER BY n) FROM per_user), 0)::bigint         AS secrets_per_user_p75,
    COALESCE((SELECT percentile_disc(0.90) WITHIN GROUP (ORDER BY n) FROM per_user), 0)::bigint         AS secrets_per_user_p90,
    COALESCE((SELECT percentile_disc(0.95) WITHIN GROUP (ORDER BY n) FROM per_user), 0)::bigint         AS secrets_per_user_p95,
    COALESCE((SELECT percentile_disc(0.99) WITHIN GROUP (ORDER BY n) FROM per_user), 0)::bigint         AS secrets_per_user_p99
FROM user_secrets;
