#!/bin/sh
set -eu

environment_name="${DEPLOY_ENVIRONMENT:?DEPLOY_ENVIRONMENT is required}"
remote_host="${DEPLOY_SSH_HOST:?DEPLOY_SSH_HOST is required}"
remote_user="${DEPLOY_SSH_USER:?DEPLOY_SSH_USER is required}"
remote_release_root="${DEPLOY_REMOTE_RELEASE_ROOT:?DEPLOY_REMOTE_RELEASE_ROOT is required}"
ssh_port="${DEPLOY_SSH_PORT:-22}"

release_dir="ci-release"
mkdir -p "$release_dir"

remote_target="${remote_user}@${remote_host}"
remote_release_dir="${remote_release_root%/}/${environment_name}-${CI_PIPELINE_ID:-manual}"

ssh_cmd() {
  if [ -n "${SSH_PASSWORD:-}" ]; then
    sshpass -p "$SSH_PASSWORD" ssh -p "$ssh_port" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$@"
  else
    ssh -p "$ssh_port" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$@"
  fi
}

ssh_cmd "$remote_target" "set -eu
release_dir='$remote_release_dir'
environment='$environment_name'
compose_file=\"\$release_dir/docker-compose.\$environment.yml\"
render_env_file=\"\$release_dir/compose.env\"
project_name=\"lrt-\$environment-virtualtour\"
carriage_return=\$(awk 'BEGIN { printf \"%c\", 13 }')
[ -f \"\$compose_file\" ] || { echo \"Compose file not found: \$compose_file\" >&2; exit 1; }
[ -f \"\$render_env_file\" ] || { echo \"Rendered env file not found: \$render_env_file\" >&2; exit 1; }
docker compose --project-name \"\$project_name\" --env-file \"\$render_env_file\" -f \"\$compose_file\" ps
container_name=\$(awk -F= '/^VIRTUALTOUR_CONTAINER_NAME=/{print \$2}' \"\$render_env_file\" | tail -n 1 | tr -d \"\$carriage_return\")
http_bind=\$(awk -F= '/^VIRTUALTOUR_HTTP_BIND=/{print \$2}' \"\$render_env_file\" | tail -n 1 | tr -d \"\$carriage_return\")
http_port=\$(awk -F= '/^VIRTUALTOUR_HTTP_PORT=/{print \$2}' \"\$render_env_file\" | tail -n 1 | tr -d \"\$carriage_return\")
[ -n \"\$container_name\" ] || container_name=\"lrt-\$environment-virtualtour-web\"
[ -n \"\$http_bind\" ] || http_bind='0.0.0.0'
if [ -z \"\$http_port\" ]; then
  if [ \"\$environment\" = prod ]; then http_port=80; else http_port=5011; fi
fi
if [ \"\$environment\" = prod ] && [ \"\$http_port\" != 80 ]; then
  echo \"Production must publish only port 80; got \$http_port\" >&2
  exit 1
fi
deadline=\$(( \$(date +%s) + 120 ))
status=''
while [ \$(date +%s) -lt \$deadline ]; do
  status=\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \"\$container_name\" 2>/dev/null || true)
  if [ \"\$status\" = healthy ] || [ \"\$status\" = running ]; then
    break
  fi
  sleep 5
done
if [ \"\$status\" != healthy ] && [ \"\$status\" != running ]; then
  docker logs --tail 100 \"\$container_name\" || true
  echo \"Container \$container_name is not healthy: \${status:-unknown}\" >&2
  exit 1
fi
docker exec \"\$container_name\" wget -q -O /dev/null http://127.0.0.1:3000/api/health
probe_host=\"\$http_bind\"
[ \"\$probe_host\" = '0.0.0.0' ] && probe_host='127.0.0.1'
if command -v curl >/dev/null 2>&1; then
  curl -fsS --max-time 5 \"http://\$probe_host:\$http_port/api/health\" >/dev/null
else
  wget -q -O /dev/null \"http://\$probe_host:\$http_port/api/health\"
fi"

cat > "${release_dir}/verify-summary.md" <<EOF
# Rollout Verification

- Environment: \`${environment_name}\`
- Remote host: \`${remote_host}\`
- Status: healthy
EOF

