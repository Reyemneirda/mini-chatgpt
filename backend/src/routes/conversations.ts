import { Router } from 'express';
import { z } from 'zod';
import { ConversationService } from '../services/conversationService';
import { logger } from '../utils/logger';

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

export function createConversationsRouter(conversationService: ConversationService) {
  // Create a conversation
  router.post('/', async (req, res, next) => {
    try {
      logger.info('Creating new conversation', { correlationId: req.correlationId });
      const conversation = await conversationService.createConversation();

      res.status(201).json({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // List conversations
  router.get('/', async (req, res, next) => {
    try {
      logger.info('Listing conversations', { correlationId: req.correlationId });
      const conversations = await conversationService.listConversations();
      res.json(conversations);
    } catch (error) {
      next(error);
    }
  });

  // Get a conversation with paginated messages
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const messagesCursor = req.query.messagesCursor as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      logger.info('Getting conversation', {
        correlationId: req.correlationId,
        id,
        messagesCursor,
        limit
      });

      const conversation = await conversationService.getConversation(id, messagesCursor, limit);
      res.json(conversation);
    } catch (error) {
      next(error);
    }
  });

  // Delete a conversation
  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      logger.info('Deleting conversation', { correlationId: req.correlationId, id });

      await conversationService.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Send a message
  router.post('/:id/messages', async (req, res, next) => {
    try {
      const { id } = req.params;
      const validatedBody = sendMessageSchema.parse(req.body);

      logger.info('Sending message', {
        correlationId: req.correlationId,
        conversationId: id
      });

      const result = await conversationService.sendMessage(id, validatedBody.content);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
