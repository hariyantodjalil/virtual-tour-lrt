#!/bin/sh
set -eu

mkdir -p ci-release

if [ -f ci-release/release.env ]; then
  set -a
  . ci-release/release.env
  set +a
fi

resolve_var() {
  var_name="$1"
  if [ -z "$var_name" ]; then
    return 0
  fi
  eval "printf '%s' \"\${$var_name:-}\""
}

image_repo="$(resolve_var "${IMAGE_REPO_VAR:?IMAGE_REPO_VAR is required}")"
image_tags="$(resolve_var "${IMAGE_TAGS_VAR:?IMAGE_TAGS_VAR is required}")"

if [ -z "$image_repo" ]; then
  echo "Resolved image repo is empty for variable ${IMAGE_REPO_VAR}" >&2
  exit 2
fi

if [ -z "$image_tags" ]; then
  echo "Resolved image tags are empty for variable ${IMAGE_TAGS_VAR}" >&2
  exit 2
fi

image_tags="$(printf '%s' "$image_tags" | tr ',' ' ')"

tags=""
primary_tag=""
for tag in $image_tags; do
  tags="$tags --tag ${image_repo}:$tag"
  if [ -z "$primary_tag" ]; then
    primary_tag="$tag"
  fi
done

build_args=""
if [ -n "${BUILD_ARGS:-}" ]; then
  build_args_file="$(mktemp)"
  printf '%s\n' "$BUILD_ARGS" > "$build_args_file"
  while IFS= read -r arg; do
    [ -n "$arg" ] || continue
    build_args="$build_args --build-arg $arg"
  done < "$build_args_file"
  rm -f "$build_args_file"
fi

cache_image="$(resolve_var "${CACHE_IMAGE_VAR:-}")"
if [ -z "$cache_image" ]; then
  cache_image="${image_repo}:buildcache"
fi

cache_mode="${IMAGE_CACHE_MODE:-auto}"
if [ "$cache_mode" = "auto" ]; then
  cache_mode="daemon"
fi

publish_mode="${PUBLISH_MODE:-registry}"
primary_ref="${image_repo}:${primary_tag}"
push_max_attempts="${IMAGE_PUSH_MAX_ATTEMPTS:-3}"
push_retry_delay="${IMAGE_PUSH_RETRY_DELAY_SECONDS:-5}"

push_image_ref() {
  ref="$1"
  attempt=1
  while [ "$attempt" -le "$push_max_attempts" ]; do
    if docker push "$ref"; then
      return 0
    fi

    if [ "$attempt" -ge "$push_max_attempts" ]; then
      break
    fi

    echo "docker push failed for $ref (attempt $attempt/$push_max_attempts); retrying in ${push_retry_delay}s..." >&2
    if [ "$publish_mode" = "registry" ] && [ -n "${REGISTRY_HOST:-}" ] && [ -n "${REGISTRY_USERNAME:-}" ] && [ -n "${REGISTRY_PASSWORD:-}" ]; then
      printf '%s' "$REGISTRY_PASSWORD" | docker login "$REGISTRY_HOST" --username "$REGISTRY_USERNAME" --password-stdin >/dev/null 2>&1 || true
    fi
    sleep "$push_retry_delay"
    attempt=$((attempt + 1))
  done

  echo "docker push failed for $ref after ${push_max_attempts} attempts" >&2
  return 1
}

if [ "$publish_mode" = "archive" ]; then
  docker build --pull \
    $build_args \
    $tags \
    --file "${DOCKERFILE_PATH:?DOCKERFILE_PATH is required}" \
    "${DOCKER_CONTEXT:-.}"

  tagged_refs="$primary_ref"
  for tag in $image_tags; do
    ref="${image_repo}:$tag"
    if [ "$ref" != "$primary_ref" ]; then
      docker tag "$primary_ref" "$ref"
      tagged_refs="$tagged_refs $ref"
    fi
  done

  image_job_name="${IMAGE_JOB_NAME:-$(basename "${image_repo}")}"
  archive_dir="ci-release/images"
  archive_path="${archive_dir}/${image_job_name}.tar"
  mkdir -p "$archive_dir"
  docker save $tagged_refs -o "$archive_path"
  gzip -f "$archive_path"
else
  docker build --pull \
    $build_args \
    $tags \
    --file "${DOCKERFILE_PATH:?DOCKERFILE_PATH is required}" \
    "${DOCKER_CONTEXT:-.}"

  for tag in $image_tags; do
    push_image_ref "${image_repo}:${tag}"
  done
fi

image_job_name="${IMAGE_JOB_NAME:-$(basename "${image_repo}")}"
{
  printf 'PUBLISH_MODE=%s\n' "$publish_mode"
  printf 'IMAGE_CACHE_MODE=%s\n' "$cache_mode"
  printf 'IMAGE_REPO=%s\n' "$image_repo"
  printf 'IMAGE_PRIMARY_TAG=%s\n' "$primary_tag"
  printf 'IMAGE_PRIMARY_REF=%s:%s\n' "$image_repo" "$primary_tag"
  if [ "$publish_mode" = "archive" ]; then
    printf 'IMAGE_ARCHIVE=%s\n' "ci-release/images/${image_job_name}.tar.gz"
  fi
} > "ci-release/${image_job_name}.env"

