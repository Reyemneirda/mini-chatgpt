import { PrismaClient } from '@prisma/client';
import { LlmAdapter } from './llm';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class ConversationService {
  private llmAdapter: LlmAdapter;
  private conversationCounter = 0;

  constructor(llmAdapter: LlmAdapter) {
    this.llmAdapter = llmAdapter;
    this.initCounter();
  }

  private async initCounter() {
    const count = await prisma.conversation.count();
    this.conversationCounter = count;
  }

  async createConversation() {
    this.conversationCounter++;
    const title = `Conversation #${this.conversationCounter}`;

    const conversation = await prisma.conversation.create({
      data: { title },
    });

    logger.info('Created conversation', { id: conversation.id, title });
    return conversation;
  }

  async listConversations() {
    const conversations = await prisma.conversation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      lastMessageAt: conv.messages[0]?.createdAt.toISOString() || null,
    }));
  }

  async getConversation(id: string, messagesCursor?: string, limit: number = 20) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Cursor pagination
    const where: any = { conversationId: id };
    if (messagesCursor) {
      where.id = { lte: messagesCursor };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check for next page
    });

    const hasMore = messages.length > limit;
    const pageMessages = hasMore ? messages.slice(0, limit) : messages;

    // Get prev cursor (oldest message on current page)
    let prevCursor: string | null = null;
    if (messagesCursor) {
      const olderMessages = await prisma.message.findMany({
        where: {
          conversationId: id,
          id: { gt: pageMessages[pageMessages.length - 1]?.id },
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
      });
      prevCursor = olderMessages[0]?.id || null;
    }

    return {
      id: conversation.id,
      title: conversation.title,
      messages: pageMessages.reverse().map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
      pageInfo: {
        nextCursor: hasMore ? messages[limit].id : null,
        prevCursor,
      },
    };
  }

  async deleteConversation(id: string) {
    await prisma.conversation.delete({
      where: { id },
    });

    logger.info('Deleted conversation', { id });
  }

  async sendMessage(conversationId: string, content: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content,
      },
    });

    // Build conversation history for LLM
    const messages = [
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    try {
      // Call LLM
      const response = await this.llmAdapter.complete({ messages });

      // Save assistant message
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: response.completion,
        },
      });

      // Update conversation lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: assistantMessage.createdAt },
      });

      return {
        message: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt.toISOString(),
        },
        reply: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt.toISOString(),
        },
      };
    } catch (error) {
      logger.error('Failed to get LLM response', { error });
      throw error;
    }
  }
}
