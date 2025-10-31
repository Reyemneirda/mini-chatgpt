import express from 'express';
import cors from 'cors';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { correlationIdMiddleware } from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';
import { createLlmAdapter } from './services/llm';
import { ConversationService } from './services/conversationService';
import { createConversationsRouter } from './routes/conversations';
import healthRouter from './routes/health';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);

// Health check routes
app.use(healthRouter);

// Initialize LLM adapter
const llmAdapter = createLlmAdapter(config.llm);
logger.info('LLM adapter initialized', { provider: config.llm.provider });

// Initialize services
const conversationService = new ConversationService(llmAdapter);

// API routes
app.use('/api/conversations', createConversationsRouter(conversationService));

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info(`Backend server listening on port ${config.port}`);
  logger.info(`LLM Provider: ${config.llm.provider}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
