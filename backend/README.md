# OmniConnect Backend

Real-time backend service for OmniConnect - handles WebSocket connections, matchmaking, and WebRTC signaling.

## Architecture

- **Node.js + Socket.IO** for persistent WebSocket connections
- **Redis** for distributed state (queues, sessions, matches)
- **JWT** for authentication (tokens issued by Next.js frontend)

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set environment variables:
\`\`\`bash
export REDIS_URL=redis://localhost:6379
export SESSION_SECRET=your-jwt-secret  # Must match Next.js
export PORT=3001
export CORS_ORIGIN=http://localhost:3000
\`\`\`

3. Run development server:
\`\`\`bash
npm run dev
\`\`\`

4. Build for production:
\`\`\`bash
npm run build
npm start
\`\`\`

## Deployment

### Fly.io
\`\`\`bash
fly launch
fly secrets set REDIS_URL=your-redis-url SESSION_SECRET=your-secret
fly deploy
\`\`\`

### Railway
Connect your repo and set environment variables in the dashboard.

## Redis Keys

- \`queue:{mode}:{connectionType}\` - FIFO queue for matching
- \`session:{sessionId}\` - Session metadata
- \`socket:{socketId}\` - Maps socket ID to session ID
- \`match:{matchId}\` - Active match data

## Events

### Client → Server
- \`join-queue\` - Join matchmaking queue
- \`next\` - Skip current peer, find new match
- \`leave\` - Leave current match/queue
- \`signal\` - WebRTC signaling (offer/answer/ICE)
- \`get-stats\` - Request platform stats

### Server → Client
- \`matched\` - Match found
- \`peer-left\` - Peer clicked leave
- \`peer-skipped\` - Peer clicked next
- \`signal\` - WebRTC signal from peer
- \`stats\` - Platform statistics
- \`error\` - Error message
