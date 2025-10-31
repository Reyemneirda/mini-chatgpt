# Mini ChatGPT

A minimal ChatGPT-style web application with support for both mock and real LLM integrations via Ollama.

## Features

✨ **Core Functionality**
- Full-featured chat interface with conversation management
- Support for multiple conversations with auto-numbered titles
- Persistent storage across service restarts
- Real-time message streaming (mock delays simulated)

🔄 **Reliability**
- Automatic retry with exponential backoff for failed requests
- 12-second timeout with graceful error handling
- Request cancellation support
- Optimistic UI with 5-second undo for deletions

📱 **User Experience**
- Responsive design for mobile and desktop
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Empty, loading, and error states
- Accessible UI with ARIA labels

🏗️ **Architecture**
- Pluggable LLM adapter pattern
- Config-only provider switching (mock ↔ Ollama)
- Cursor-based pagination for messages
- Type-safe API with validation
- Structured logging with correlation IDs
- Health check endpoints (/healthz, /readyz)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Running the Application

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mini-chatgpt
   ```

2. **Build and start all services**
   ```bash
   docker compose build
   docker compose up
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Mock LLM: http://localhost:8080

4. **Health checks**
   - http://localhost:3001/healthz
   - http://localhost:3001/readyz

### Stopping the Application

```bash
docker compose down
```

To remove volumes (database data):
```bash
docker compose down -v
```

## Switching to Ollama (Real LLM)

### Option 1: Use Ollama via Docker Compose

1. **Uncomment the Ollama service** in `docker-compose.yml`:
   ```yaml
   ollama:
     image: ollama/ollama:latest
     ports:
       - "11434:11434"
     volumes:
       - ollama_data:/root/.ollama
   ```

2. **Uncomment the volume**:
   ```yaml
   volumes:
     postgres_data:
     ollama_data:
   ```

3. **Update backend environment** in `docker-compose.yml`:
   ```yaml
   environment:
     LLM_PROVIDER: ollama  # Change from 'mock' to 'ollama'
   ```

4. **Rebuild and restart**:
   ```bash
   docker compose down
   docker compose build
   docker compose up -d
   ```

5. **Pull the model** (first time only):
   ```bash
   docker exec -it mini-chatgpt-ollama ollama pull llama3
   ```

### Option 2: Use Local Ollama Installation

If you have Ollama installed locally:

1. **Start Ollama** on your host machine

2. **Update backend environment** in `docker-compose.yml`:
   ```yaml
   environment:
     LLM_PROVIDER: ollama
     OLLAMA_BASE_URL: http://host.docker.internal:11434  # Mac/Windows
     # OLLAMA_BASE_URL: http://172.17.0.1:11434  # Linux
   ```

3. **Restart services**:
   ```bash
   docker compose restart backend
   ```

## Project Structure

```
mini-chatgpt/
├── backend/                 # Node.js + TypeScript + Express
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic + LLM adapters
│   │   ├── middleware/     # Error handling, correlation IDs
│   │   └── utils/          # Config, logging
│   ├── prisma/             # Database schema + migrations
│   └── Dockerfile
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── api.ts         # API client
│   │   └── App.tsx        # Main app
│   └── Dockerfile
├── mock-llm/              # Mock LLM service (as provided)
│   ├── server.js
│   └── Dockerfile
├── docker-compose.yml     # Orchestrates all services
├── DECISIONS.md          # Technical decisions explained
└── README.md             # This file
```

## API Endpoints

### Conversations

- `POST /api/conversations` - Create a new conversation
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation with messages (paginated)
- `DELETE /api/conversations/:id` - Delete a conversation

### Messages

- `POST /api/conversations/:id/messages` - Send a message and get assistant reply

### Health

- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe (checks DB connection)

## Environment Variables

### Backend

```bash
# Server
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/chatgpt?schema=public

# LLM Provider
LLM_PROVIDER=mock|ollama
MOCK_LLM_BASE_URL=http://mock-llm:8080
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3

# Timeouts & Retries
LLM_TIMEOUT_MS=12000
LLM_MAX_RETRIES=2
LLM_RETRY_DELAY_MS=1000
```

### Frontend

```bash
VITE_API_URL=http://backend:3001
```

## Development

### Backend Development

```bash
cd backend
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Database Migrations

```bash
cd backend

# Create a new migration
npm run migrate:dev

# Apply migrations (production)
npm run migrate
```

## Testing the Mock LLM Behavior

The mock LLM simulates real-world failure scenarios:
- **10% chance** of hanging (no response)
- **20% chance** of returning 500 error
- **500-2000ms** random delay

The application handles these gracefully with:
- Automatic retries (up to 2) with exponential backoff
- 12-second timeout with user-friendly error message
- Cancel button to abort in-flight requests

## Key Features Demonstrated

### ✅ Optimistic Delete with Undo

1. Click delete on a conversation
2. It disappears immediately
3. Yellow "Undo" banner appears for 5 seconds
4. Click "Undo" to restore, or wait for permanent deletion

### ✅ Request Cancellation

1. Send a message
2. Click "Cancel" while waiting
3. Request is aborted
4. Input is re-enabled
5. No error shown to user

### ✅ Cursor Pagination

Messages are paginated using cursor-based pagination:
- Fetch older messages: Use `nextCursor`
- Fetch newer messages: Use `prevCursor`
- Stable results even as new messages arrive

### ✅ Responsive Design

- **Desktop:** Sidebar + chat area side-by-side
- **Mobile:** Hamburger menu to toggle sidebar
- Touch-friendly tap targets
- Accessible keyboard navigation

## Architecture Highlights

### LLM Adapter Pattern

The adapter pattern enables zero-code provider switching:

```typescript
interface LlmAdapter {
  complete(messages): Promise<{ completion: string }>
}

class MockLlmAdapter implements LlmAdapter { }
class OllamaLlmAdapter implements LlmAdapter { }
```

Factory creates the right adapter based on `LLM_PROVIDER` env var.

**Benefits:**
- Add new providers (OpenAI, Claude) without touching business logic
- Easy to test with mock adapter
- Type-safe across entire codebase

### Database Schema

```
Conversation
├── id (cuid)
├── title (auto-numbered)
├── createdAt
├── lastMessageAt
└── messages (one-to-many)

Message
├── id (cuid)
├── conversationId (foreign key, cascade delete)
├── role (user | assistant)
├── content
└── createdAt
```

**Indexes for Performance:**
- `(conversationId, createdAt)` - efficient message pagination
- `createdAt` - conversation ordering

## Production Considerations

This implementation includes production-ready features:

✅ Real database with migrations
✅ Health checks for orchestration
✅ Structured logging with correlation IDs
✅ Graceful error handling
✅ Input validation
✅ Docker multi-stage builds
✅ Dependency health checks in compose

**Additional steps for production:**
- Add authentication/authorization
- Implement rate limiting
- Enable HTTPS/TLS
- Set up log aggregation
- Add monitoring/alerting
- Use secrets management
- Configure auto-scaling

## Troubleshooting

### Services won't start

Check service health:
```bash
docker compose ps
docker compose logs backend
docker compose logs db
```

### Database connection errors

```bash
# Reset database
docker compose down -v
docker compose up -d db
docker compose up backend
```

### Ollama model not loaded

```bash
docker exec -it mini-chatgpt-ollama ollama list
docker exec -it mini-chatgpt-ollama ollama pull llama3
```

### Port conflicts

If ports 3000, 3001, 5432, or 8080 are in use:
1. Stop other services using those ports
2. Or modify ports in `docker-compose.yml`

## Technical Decisions

For detailed explanations of technical choices, see [DECISIONS.md](./DECISIONS.md).

Topics covered:
- Database choice and schema design
- Retry, timeout, and cancellation logic
- Pagination implementation
- LLM adapter architecture
- Tradeoffs and alternatives

## License

MIT

## Acknowledgments

Assignment provided as part of a full-stack engineering assessment.
