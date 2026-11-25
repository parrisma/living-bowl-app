#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NODE_VERSION="${NODE_VERSION:-22}"
IMAGE="living-bowl-dev:latest"
DOCKER_SOCKET="${DOCKER_SOCKET:-/var/run/docker.sock}"

if [ ! -S "$DOCKER_SOCKET" ]; then
    echo "Error: Docker socket not found at $DOCKER_SOCKET."
    echo "Enable the host Docker daemon before building the development image."
    exit 1
fi

DOCKER_GID="$(stat -c '%g' "$DOCKER_SOCKET")"

echo "Building $IMAGE with Node.js $NODE_VERSION..."
docker build \
    --build-arg "NODE_VERSION=$NODE_VERSION" \
    --build-arg "USER_UID=$(id -u)" \
    --build-arg "USER_GID=$(id -g)" \
    --build-arg "DOCKER_GID=$DOCKER_GID" \
    -f "$SCRIPT_DIR/Dockerfile.dev" \
    -t "$IMAGE" \
    "$PROJECT_ROOT"

echo "Build complete: $IMAGE"
docker images "$IMAGE" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
