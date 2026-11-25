#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="living-bowl-dev"
IMAGE="living-bowl-dev:latest"
DOCKER_SOCKET="${DOCKER_SOCKET:-/var/run/docker.sock}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Error: $IMAGE not found. Build it first with docker/build-dev.sh."
    exit 1
fi

if [ ! -S "$DOCKER_SOCKET" ]; then
    echo "Error: Docker socket not found at $DOCKER_SOCKET."
    echo "Ensure the host Docker daemon is running and available to this environment."
    exit 1
fi

DOCKER_SOCKET_GID="$(stat -c '%g' "$DOCKER_SOCKET")"

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker run -d \
        --name "$CONTAINER_NAME" \
        --mount "type=bind,source=$PROJECT_ROOT,target=/home/app" \
        --mount "type=volume,source=living-bowl-node-modules,target=/home/app/node_modules" \
        --mount "type=bind,source=$DOCKER_SOCKET,target=/var/run/docker.sock" \
        --group-add "$DOCKER_SOCKET_GID" \
        -p "${EXPO_PORT:-8081}:8081" \
        "$IMAGE"
else
    MOUNTS="$(docker inspect --format '{{range .Mounts}}{{.Destination}} {{end}}' "$CONTAINER_NAME")"
    for REQUIRED_MOUNT in /home/app /home/app/node_modules /var/run/docker.sock; do
        case " $MOUNTS " in
            *" $REQUIRED_MOUNT "*) ;;
            *)
                echo "Error: Existing container $CONTAINER_NAME uses outdated mounts."
                echo "Remove that container and rerun this script."
                exit 1
                ;;
        esac
    done

    RUNNING="$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")"
    if [ "$RUNNING" != "true" ]; then
        docker start "$CONTAINER_NAME" >/dev/null
    fi
fi

if [ "$#" -gt 0 ]; then
    docker exec -it "$CONTAINER_NAME" "$@"
else
    echo "Container is running: $CONTAINER_NAME"
    echo "Attach with VS Code: Dev Containers: Attach to Running Container..."
    echo "Then run the one-time setup: bash docker/setup-project.sh"
fi
