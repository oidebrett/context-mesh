#!/bin/bash

# Configuration
IMAGE_NAME="oideibrett/context-mesh"
TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

echo "🚀 Starting multi-arch build for ${FULL_IMAGE_NAME}..."

# Build and push the image for both amd64 and arm64
# This requires docker buildx to be set up
docker buildx build --platform linux/amd64,linux/arm64 -t "${FULL_IMAGE_NAME}" --push .

if [ $? -ne 0 ]; then
    echo "❌ Multi-arch build and push failed!"
    echo "Tips: Run 'docker buildx create --use' if you haven't set up a builder."
    exit 1
fi

echo "🎉 Successfully built and pushed ${FULL_IMAGE_NAME} for amd64 and arm64"
exit 0
