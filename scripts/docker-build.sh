#!/bin/bash
set -euo pipefail

# docker-build.sh - Build and run the Ta Cukrárna Docker test environment
# This script builds the Docker image and starts the test container
# for full PHP stack E2E tests with real opening-hours.php backend.
#
# Usage:
#   scripts/docker-build.sh          # build and start (default)
#   scripts/docker-build.sh build    # only build the image
#   scripts/docker-build.sh run      # only start/run the container
#   scripts/docker-build.sh stop     # stop and remove the container
#   scripts/docker-build.sh clean    # remove the image

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="ta-cukrarna/test"
CONTAINER_NAME="ta-cukrarna-test"

show_help() {
    echo "Usage: $0 [build|run|stop|clean|help]"
    echo ""
    echo "  build      Build the Docker image only"
    echo "  run        Build image and start the container detached on port 80"
    echo "  stop       Stop and remove the container"
    echo "  clean      Remove the Docker image"
    echo "  help       Show this help message"
    echo ""
    echo "The Docker environment uses Debian 12 (bookworm) with Apache + PHP 8.5"
    echo "and serves the static export + PHP API for E2E tests against localhost."
}

check_prerequisites() {
    if ! command -v docker &>/dev/null; then
        echo "Error: Docker is not installed or not in PATH" >&2
        exit 1
    fi

    if ! docker info &>/dev/null; then
        echo "Error: Docker daemon is not running" >&2
        exit 1
    fi
}

do_build() {
    echo "🔨 Building Docker image: $IMAGE_NAME"
    docker build \
        --pull \
        --tag "$IMAGE_NAME" \
        --file "$PROJECT_DIR/docker/Dockerfile.test" \
        "$PROJECT_DIR"

    echo "✅ Image built successfully"
    echo "   To start the test container: $0 run"
}

do_run() {
    check_prerequisites

    # Build if image doesn't exist
    if [ "$(docker images -q "$IMAGE_NAME" 2>/dev/null | wc -l)" -eq 0 ]; then
        echo "🔨 Image not found, building..."
        do_build
    fi

    # Stop existing container if running
    if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
        echo "♻️  Stopping existing container..."
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    fi

    echo "🚀 Starting test container: $CONTAINER_NAME"
    echo "   Container will be available at http://localhost"

    # Mounts mirror the VPS layout: docroot = static export contents, PHP API
    # at /api/. Writable: docroot (atomic opening-hours.jsonc saves) and
    # api/DB (SQLite passkeys store + debug log, seeded at container start).
    # NOTE: opening-hours.jsonc is NOT a single-file mount - the admin save
    # atomically renames over it, which fails (EXDEV) on a file mount; the
    # docroot copy inside the out/ mount is the runtime state instead.
    # .env.docker (if present, see .env.docker.example) is mounted at the
    # path loadEnv() reads - one level above the docroot.
    local env_mount=()
    if [ -f "$PROJECT_DIR/.env.docker" ]; then
        env_mount=(--volume "$PROJECT_DIR/.env.docker:/var/www/.env:ro")
    fi

    docker run -d --name "$CONTAINER_NAME" \
        --publish 80:80 \
        --volume "$PROJECT_DIR/out:/var/www/html" \
        --volume "$PROJECT_DIR/public/api:/var/www/html/api:ro" \
        --volume "$PROJECT_DIR/public/api/DB:/var/www/html/api/DB" \
        --volume "$PROJECT_DIR/scripts/docker-entrypoint.sh:/usr/local/bin/docker-entrypoint.sh:ro" \
        --volume "$PROJECT_DIR/docker/seed-passkeys.php:/usr/local/bin/seed-passkeys.php:ro" \
        "${env_mount[@]}" \
        --env PLAYWRIGHT_TEST_MODE=true \
        "$IMAGE_NAME"

    echo "✅ Container started"
    echo "   Run tests against it on demand, e.g.: npm run test:e2e:docker"
}

do_stop() {
    check_prerequisites

    if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
        echo "🛑 Stopping container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        echo "✅ Container stopped and removed"
    else
        echo "ℹ️  Container $CONTAINER_NAME is not running"
    fi
}

do_clean() {
    check_prerequisites

    echo "🧹 Removing image: $IMAGE_NAME"
    docker rmi "$IMAGE_NAME" 2>/dev/null || echo "⚠️  Image not found (may not exist)"

    do_stop

    echo "✅ Cleanup complete"
}

# Parse command
case "${1:-run}" in
    build)
        check_prerequisites
        do_build
        ;;
    run)
        check_prerequisites
        do_run
        ;;
    stop)
        do_stop
        ;;
    clean)
        check_prerequisites
        do_clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1" >&2
        show_help
        exit 1
        ;;
esac