# Minimal GitHub Actions Runner for ta-cukrarna
# Based on Alpine Linux for minimal footprint
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    bash \
    curl \
    git \
    jq \
    openssh-client \
    rsync \
    sudo \
    tar

# Create runner user
RUN addgroup -g 1000 runner && \
    adduser -D -u 1000 -G runner runner && \
    echo "runner ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install GitHub Actions Runner
WORKDIR /home/runner
USER runner

# Download and install GitHub Actions runner
ARG RUNNER_VERSION="2.311.0"
RUN curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz && \
    echo "29fc8cf2dab4c195bb147384e7e2c94cfd4d4022c793b346a6175435265aa278  actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" | sha256sum -c && \
    tar xzf ./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz && \
    rm actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz

# Install runner dependencies
RUN sudo ./bin/installdependencies.sh

# Configure npm for performance
RUN npm config set update-notifier false && \
    npm config set audit false && \
    npm config set fund false

# Copy entrypoint script
COPY --chown=runner:runner entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Set working directory for builds
WORKDIR /home/runner/_work

ENTRYPOINT ["/home/runner/entrypoint.sh"]
