#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking development environment...${NC}"

# 1. Check/Start Redis
if pgrep -x "redis-server" > /dev/null; then
    echo -e "${GREEN}✓ Redis is running.${NC}"
else
    echo -e "${YELLOW}Redis is not running. Attempting to start...${NC}"
    
    if command -v redis-server &> /dev/null; then
        echo "Starting local redis-server..."
        redis-server --daemonize yes
        echo -e "${GREEN}✓ Redis started.${NC}"
    elif command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            echo "Starting Redis via Docker..."
            if docker ps -a --format '{{.Names}}' | grep -q "^redis-dev$"; then
                docker start redis-dev
            else
                docker run -d -p 6379:6379 --name redis-dev redis
            fi
            echo -e "${GREEN}✓ Redis container started.${NC}"
        else
            echo -e "${RED}✘ Docker is installed but not running/accessible.${NC}"
            echo "Please start Docker or install redis-server locally."
            exit 1
        fi
    else
        echo -e "${RED}✘ Neither redis-server nor Docker found.${NC}"
        echo "Please install Redis: sudo apt install redis-server"
        echo "Or provide a remote REDIS_URL."
        exit 1
    fi
fi

# 2. Start App
export REDIS_URL=${REDIS_URL:-"redis://localhost:6379"}
echo -e "${GREEN}Starting Next.js Dev Server with ${REDIS_URL}...${NC}"

pnpm dev
