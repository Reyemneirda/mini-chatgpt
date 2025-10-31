# Technical Decisions

This document explains the key technical decisions made in implementing the Mini ChatGPT application.

## Database Choice: PostgreSQL

**Decision:** PostgreSQL with Prisma ORM

**Rationale:**
- **Reliability:** PostgreSQL is a battle-tested, ACID-compliant relational database
- **Data Integrity:** Foreign key constraints ensure referential integrity (cascade deletes)
- **Indexing:** Excellent support for composite indexes (conversationId + createdAt) for efficient pagination
- **Prisma Benefits:** Type-safe queries, automatic migrations, easy schema management
- **Containerization:** Official Docker image with good health check support

**Tradeoffs:**
- More resource-intensive than SQLite
- Requires a separate container
- However, provides better scalability and production-readiness

## Schema & Migration Approach

### Schema Design

```prisma
model Conversation {
  id            String    @id @default(cuid())
  title         String
  createdAt     DateTime  @default(now())
  lastMessageAt DateTime?
  messages      Message[]
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           String  
  content        String       @db.Text
  createdAt      DateTime     @default(now())
}
```

**Key Decisions:**
- **CUID for IDs:** Collision-resistant, URL-safe, sortable
- **Cascade Deletes:** Messages automatically deleted when conversation is deleted
- **Text Type:** `@db.Text` for unlimited message length
- **Indexes:**
  - `conversationId + createdAt` composite index for efficient message pagination
  - `createdAt` index on both tables for ordering

### Migration Strategy

- **Tool:** Prisma Migrate
- **Approach:** Declarative schema with automatic SQL generation
- **Deployment:** Migrations run automatically in Docker CMD before server starts
- **Repeatability:** `prisma migrate deploy` is idempotent and safe for production

**Benefits:**
- Version-controlled schema
- Automatic rollback support
- Type generation synced with schema
- No manual SQL writing

## Retry, Timeout, and Cancel Behavior

### Retry Logic

**Implementation:** Exponential backoff with max retries

```typescript
- Max retries: 2 (3 total attempts)
- Initial delay: 1000ms
- Backoff multiplier: 2x
- Retry conditions: 500 errors OR timeouts
```

**Rationale:**
- The mock LLM has 20% chance of 500 error and 10% chance of hang
- Two retries give ~98% success rate for random 500s
- Exponential backoff prevents thundering herd
- Only retry on retryable errors (not 400s)

### Timeout Handling

**Implementation:** AbortController with 12-second timeout

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 12000);
```

**Rationale:**
- Assignment requires ≤12s timeout
- Uses standard Web API (AbortController)
- Cleans up timeout on success/failure
- Properly propagates abort signal through fetch

### Cancel Functionality

**Client-side:**
- User clicks "Cancel" button
- AbortController.abort() called
- Fetch request aborted
- Input re-enabled immediately
- Error suppressed (AbortError not shown to user)

**Backend:**
- No explicit cancel endpoint needed
- Client abort terminates the fetch
- Backend naturally stops processing when client disconnects
- Idempotent design (no state corruption if request partially processed)

**Benefits:**
- Simple implementation
- No additional API endpoint needed
- Works with browser fetch cancellation
- Proper cleanup on both sides

## Pagination Model

**Decision:** Cursor-based pagination using message IDs

### Why Cursor-based?

**Assignment Requirement:** "Messages for a conversation must be cursor-paginated (not offset)"

**Benefits:**
- **Consistent results:** No duplicates/skips when new messages added
- **Performance:** Uses indexed ID instead of OFFSET
- **Real-time friendly:** Works well with live updates
- **Stable:** Cursors remain valid even as data changes

### Implementation

```typescript
// Query with cursor
const where: any = { conversationId: id };
if (messagesCursor) {
  where.id = { lte: messagesCursor };  // Get messages older than cursor
}

const messages = await prisma.message.findMany({
  where,
  orderBy: { createdAt: 'desc' },
  take: limit + 1,  // Fetch one extra to check for next page
});
```

**Cursor Encoding:**
- Direct message ID (CUID)
- No Base64 encoding needed (CUIDs are URL-safe)
- Simple and debuggable

**pageInfo Response:**
```json
{
  "nextCursor": "clxyz123...",  // ID of oldest message not returned
  "prevCursor": "clxyz789..."   // ID for newer messages
}
```

**Tradeoffs:**
- Slightly more complex than offset pagination
- Cannot jump to arbitrary page numbers
- However, provides better UX and performance for chat use case

## LLM Adapter Structure

**Decision:** Strategy pattern with factory for provider selection

### Architecture

```
┌─────────────────┐
│   LlmAdapter    │  (Interface)
│  Interface      │
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
┌────────▼────────┐ ┌──────▼──────┐ ┌───────▼────────┐
│ MockLlmAdapter  │ │OllamaAdapter│ │ Future adapters│
└─────────────────┘ └─────────────┘ └────────────────┘
         │                 │
         └────────┬────────┘
              ┌───▼───┐
              │Factory│
              └───────┘
```

### Interface Definition

```typescript
interface LlmAdapter {
  complete(input: {
    messages: Array<{role: 'user'|'assistant', content: string}>
  }): Promise<{ completion: string }>;
}
```

### Factory Pattern

```typescript
export function createLlmAdapter(config: LlmConfig): LlmAdapter {
  switch (config.provider) {
    case 'mock':
      return new MockLlmAdapter({ baseUrl, timeout, ... });
    case 'ollama':
      return new OllamaLlmAdapter({ baseUrl, model, timeout, ... });
  }
}
```

### Configuration

**Environment Variables:**
```bash
LLM_PROVIDER=mock|ollama          # Provider selection
MOCK_LLM_BASE_URL=http://mock-llm:8080
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3
LLM_TIMEOUT_MS=12000
LLM_MAX_RETRIES=2
```

**Initialization:**
```typescript
// In index.ts
const llmAdapter = createLlmAdapter(config.llm);
const conversationService = new ConversationService(llmAdapter);
```

### Switching Providers

**Zero Code Changes Required:**
1. Update `.env` or `docker-compose.yml`
2. Set `LLM_PROVIDER=ollama`
3. Restart services
4. Everything works with Ollama

### Mock Adapter Details

- Calls `POST /complete` with `{ content: string }`
- Content is joined conversation history
- Includes retry and timeout logic
- Returns normalized `{ completion: string }`

### Ollama Adapter Details

- Calls `POST /api/generate` with Ollama's schema
- Sends conversation as formatted prompt
- Normalizes response to match interface
- Same retry/timeout as mock
- Model configurable via `OLLAMA_MODEL`

### Benefits

✅ **SOLID Principles:**
- Single Responsibility: Each adapter handles one provider
- Open/Closed: Add new adapters without modifying existing code
- Dependency Inversion: Business logic depends on interface, not concrete implementations

✅ **Testability:**
- Easy to mock LLM adapter for testing
- Can add test adapter for automated tests

✅ **Extensibility:**
- Adding OpenAI, Claude, etc. is trivial
- Just implement the interface and add to factory

✅ **Configuration-driven:**
- No code changes to switch providers
- Environment variables control behavior
- Docker Compose can set per-environment configs

### Tradeoffs

**Pros:**
- Clean separation of concerns
- Easy to add new providers
- Testable and maintainable
- Type-safe across entire stack

**Cons:**
- Slightly more code than hardcoded solution
- However, the flexibility and maintainability far outweigh this

## Additional Architectural Decisions

### Frontend State Management

**Decision:** React useState and useEffect (no external state library)

**Rationale:**
- Application state is simple (conversations, messages)
- No complex cross-component state sharing
- Reduces dependencies and bundle size
- Easier for reviewers to understand

### API Design

**Decision:** RESTful with nested resources

```
POST   /api/conversations
GET    /api/conversations
GET    /api/conversations/:id
DELETE /api/conversations/:id
POST   /api/conversations/:id/messages
```

**Rationale:**
- Follows REST conventions
- Clear resource hierarchy
- Easy to understand and extend
- Matches provided API contract

### Error Handling

**Structured approach:**
1. **Backend:** Correlation IDs for request tracing
2. **Middleware:** Centralized error handler
3. **Frontend:** User-friendly error messages
4. **Logging:** Winston with JSON format for production

### Security Considerations

**Implemented:**
- Input validation (Zod schemas)
- SQL injection prevention (Prisma parameterized queries)
- CORS enabled for frontend
- No sensitive data in logs

**Production TODOs:**
- Add authentication/authorization
- Rate limiting
- HTTPS/TLS
- Environment variable secrets management

## Observability

**Health Checks:**
- `/healthz`: Basic liveness check
- `/readyz`: Includes database connectivity

**Logging:**
- Structured JSON logs
- Correlation IDs for request tracing
- Log levels (info, warn, error)
- Ready for aggregation (ELK, DataDog, etc.)

**Docker:**
- Health checks in docker-compose
- Proper service dependencies
- Graceful shutdown handling

## Summary

This implementation prioritizes:
1. **Correctness:** Proper error handling, retries, cancellation
2. **Maintainability:** Clean architecture, SOLID principles
3. **Production-readiness:** Migrations, health checks, logging
4. **Flexibility:** Easy provider switching, extensible design
5. **User Experience:** Responsive UI, optimistic updates, accessibility

The architecture is designed to be understood quickly while demonstrating production-quality engineering practices.
