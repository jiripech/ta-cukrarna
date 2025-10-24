#!/bin/bash
# NAS System Information Discovery Script
# For safe execution via SSH to HQ.lan

set -e

echo "🔍 NAS System Information Discovery"
echo "=================================="
echo "Target: HQ.lan"
echo "Mode: Individual command approval"
echo ""

# Array of safe discovery commands
declare -a DISCOVERY_COMMANDS=(
    # Basic system info
    "uname -a"
    "cat /etc/os-release"
    "hostnamectl status"

    # Hardware specs
    "lscpu"
    "free -h"
    "df -h"
    "lsblk"

    # Network info
    "ip addr show"
    "uptime"

    # Docker availability
    "which docker"
    "docker --version"
    "docker info | head -20"

    # Available resources
    "cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'"
    "cat /proc/cpuinfo | grep -E 'model name|processor' | head -5"
    "nproc"
)

# Function to execute single command with approval
execute_command() {
    local cmd="$1"
    echo ""
    echo "📋 Next command: $cmd"
    echo "🖥️  Full command: ssh root@HQ.lan '$cmd'"
    echo ""
    read -p "Execute this command? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "⚡ Executing..."
        ssh root@HQ.lan "$cmd" 2>&1 || echo "⚠️  Command failed (expected for some commands)"
        echo "✅ Command completed"
    else
        echo "⏭️  Command skipped"
    fi
}

# Main execution
echo "This script will help discover NAS specs for benchmark comparison."
echo "Each command will be shown and require your approval."
echo ""
read -p "Start discovery process? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Discovery cancelled"
    exit 1
fi

echo ""
echo "🚀 Starting safe discovery process..."

# Execute each command with approval
for cmd in "${DISCOVERY_COMMANDS[@]}"; do
    execute_command "$cmd"
done

echo ""
echo "✅ Discovery process completed!"
echo ""
echo "📊 Next steps:"
echo "1. Review the output above"
echo "2. Update docs/BENCHMARK_RESULTS.md with NAS specs"
echo "3. Deploy Docker runner on NAS if Docker is available"
echo "4. Run performance benchmarks"
echo ""
echo "💡 To deploy runner on NAS:"
echo "   1. Transfer Docker image: docker save ta-cukrarna-runner:latest | gzip | ssh root@HQ.lan 'gunzip | docker load'"
echo "   2. Run runner: ssh root@HQ.lan 'docker run -d --name ta-cukrarna-runner-nas ...'"
