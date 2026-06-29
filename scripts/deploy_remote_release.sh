#!/bin/sh
set -eu

environment_name="${DEPLOY_ENVIRONMENT:?DEPLOY_ENVIRONMENT is required}"
remote_host="${DEPLOY_SSH_HOST:?DEPLOY_SSH_HOST is required}"
remote_user="${DEPLOY_SSH_USER:?DEPLOY_SSH_USER is required}"
remote_release_root="${DEPLOY_REMOTE_RELEASE_ROOT:?DEPLOY_REMOTE_RELEASE_ROOT is required}"
remote_env_file="${DEPLOY_REMOTE_ENV_FILE:?DEPLOY_REMOTE_ENV_FILE is required}"
ssh_port="${DEPLOY_SSH_PORT:-22}"
registry_host="${REGISTRY_HOST:-${CI_REGISTRY:-}}"
registry_user="${REGISTRY_USERNAME:-${CI_REGISTRY_USER:-}}"
registry_password="${REGISTRY_PASSWORD:-${CI_REGISTRY_PASSWORD:-}}"

release_dir="ci-release"
mkdir -p "$release_dir"

remote_target="${remote_user}@${remote_host}"
remote_release_dir="${remote_release_root%/}/${environment_name}-${CI_PIPELINE_ID:-manual}"
image_env_file="${release_dir}/image-overrides.env"
registry_env_file="${release_dir}/registry-login.env"
remote_script="${release_dir}/deploy-remote.sh"

ssh_cmd() {
  if [ -n "${SSH_PASSWORD:-}" ]; then
    sshpass -p "$SSH_PASSWORD" ssh -p "$ssh_port" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$@"
  else
    ssh -p "$ssh_port" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$@"
  fi
}

scp_cmd() {
  if [ -n "${SSH_PASSWORD:-}" ]; then
    sshpass -p "$SSH_PASSWORD" scp -P "$ssh_port" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$@"
  else
    scp -P "$ssh_port" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$@"
  fi
}

printf 'LRT_VIRTUALTOUR_IMAGE=%s\n' "${LRT_VIRTUALTOUR_IMAGE:?LRT_VIRTUALTOUR_IMAGE is required}" > "$image_env_file"

if [ -n "$registry_host" ] && [ -n "$registry_user" ] && [ -n "$registry_password" ]; then
  {
    printf 'CI_REGISTRY=%s\n' "$registry_host"
    printf 'CI_REGISTRY_USER=%s\n' "$registry_user"
    printf 'CI_REGISTRY_PASSWORD=%s\n' "$registry_password"
  } > "$registry_env_file"
else
  : > "$registry_env_file"
fi

cat > "$remote_script" <<'EOF'
set -eu

release_dir="$1"
runtime_env_file="$2"
environment="$3"
compose_file="$release_dir/docker-compose.$environment.yml"
image_env_file="$release_dir/image-overrides.env"
registry_env_file="$release_dir/registry-login.env"
render_env_file="$release_dir/compose.env"
project_name="lrt-$environment-virtualtour"
carriage_return=$(awk 'BEGIN { printf "%c", 13 }')

load_env_file() {
  env_file="$1"
  [ -f "$env_file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
      *=*)
        name=${line%%=*}
        value=${line#*=}
        export "$name=$value"
        ;;
    esac
  done < "$env_file"
}

command -v docker >/dev/null 2>&1 || { echo "docker is not installed on this host" >&2; exit 127; }
docker compose version >/dev/null 2>&1 || { echo "docker compose is not available on this host" >&2; exit 127; }

[ -f "$runtime_env_file" ] || { echo "Runtime env file not found: $runtime_env_file" >&2; exit 1; }
[ -f "$compose_file" ] || { echo "Compose file not found: $compose_file" >&2; exit 1; }
[ -f "$image_env_file" ] || { echo "Image env file not found: $image_env_file" >&2; exit 1; }

cat "$runtime_env_file" "$image_env_file" | tr -d "$carriage_return" > "$render_env_file"

if [ "$environment" = "prod" ]; then
  prod_port="$(awk -F= '/^VIRTUALTOUR_HTTP_PORT=/{print $2}' "$render_env_file" | tail -n 1)"
  prod_port="${prod_port:-80}"
  [ "$prod_port" = "80" ] || { echo "Production must publish only port 80; got $prod_port" >&2; exit 1; }
fi

if [ -s "$registry_env_file" ]; then
  load_env_file "$registry_env_file"
  if [ -n "${CI_REGISTRY:-}" ] && [ -n "${CI_REGISTRY_USER:-}" ] && [ -n "${CI_REGISTRY_PASSWORD:-}" ]; then
    printf '%s' "$CI_REGISTRY_PASSWORD" | docker login "$CI_REGISTRY" -u "$CI_REGISTRY_USER" --password-stdin
  fi
fi

docker compose --project-name "$project_name" --env-file "$render_env_file" -f "$compose_file" pull virtualtour
docker compose --project-name "$project_name" --env-file "$render_env_file" -f "$compose_file" up -d postgres
docker compose --project-name "$project_name" --env-file "$render_env_file" -f "$compose_file" run --rm virtualtour npx prisma migrate deploy
docker compose --project-name "$project_name" --env-file "$render_env_file" -f "$compose_file" up -d --remove-orphans virtualtour
docker compose --project-name "$project_name" --env-file "$render_env_file" -f "$compose_file" ps
EOF

ssh_cmd "$remote_target" "mkdir -p '$remote_release_dir'"
scp_cmd "docker-compose.${environment_name}.yml" "$image_env_file" "$registry_env_file" "$remote_script" "${remote_target}:${remote_release_dir}/"
ssh_cmd "$remote_target" "chmod +x '$remote_release_dir/deploy-remote.sh' && '$remote_release_dir/deploy-remote.sh' '$remote_release_dir' '$remote_env_file' '$environment_name'"

cat > "${release_dir}/deploy-summary.md" <<EOF
# Remote Deployment

- Environment: \`${environment_name}\`
- Remote host: \`${remote_host}\`
- Remote release dir: \`${remote_release_dir}\`
- Runtime env file: \`${remote_env_file}\`
EOF

