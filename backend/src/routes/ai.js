import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { chatWithAssistant, generateSegmentRules, generateCampaignMessage, suggestChannel, getActiveProviders } from '../services/groqService.js';
import { countSegment } from '../services/segmentEngine.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/ai/providers - which AI providers are configured
router.get('/providers', (req, res) => {
  res.json(getActiveProviders());
});

// POST /api/ai/chat - streaming chat with AI assistant
router.post('/chat', async (req, res) => {
  try {
    const { messages, sessionId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Get context for AI
    const [customerCount, campaignCount, segmentCount, revenue] = await Promise.all([
      prisma.customer.count(),
      prisma.campaign.count(),
      prisma.segment.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        where: {
          orderedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          status: 'completed'
        },
        _sum: { amount: true }
      })
    ]);

    const context = {
      totalCustomers: customerCount,
      totalCampaigns: campaignCount,
      activeSegments: segmentCount,
      monthlyRevenue: revenue._sum.amount || 0
    };

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const stream = await chatWithAssistant(messages, context);

    let fullContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // Save conversation if sessionId provided
    if (sessionId && messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1];
      await prisma.aiConversation.createMany({
        data: [
          { sessionId, role: lastUserMsg.role, content: lastUserMsg.content },
          { sessionId, role: 'assistant', content: fullContent }
        ]
      }).catch(() => {}); // Don't fail on save error
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    logger.error('AI chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// POST /api/ai/segment - generate segment from natural language
router.post('/segment', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    const stats = await prisma.customer.aggregate({
      _avg: { totalSpend: true, orderCount: true },
      _max: { totalSpend: true, orderCount: true },
      _count: { id: true }
    });

    const generated = await generateSegmentRules(prompt, {
      totalCustomers: stats._count.id,
      avgSpend: Math.round(stats._avg.totalSpend || 0),
      maxSpend: Math.round(stats._max.totalSpend || 0),
      avgOrders: Math.round(stats._avg.orderCount || 0)
    });

    const count = await countSegment(generated.rules);
    res.json({ ...generated, estimatedCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/message - generate campaign message
router.post('/message', async (req, res) => {
  try {
    const { intent, channel, segmentDescription } = req.body;
    const message = await generateCampaignMessage(
      intent || 'promote our latest offer',
      channel || 'whatsapp',
      segmentDescription || 'loyal customers'
    );
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/suggest-channel
router.post('/suggest-channel', async (req, res) => {
  try {
    const { segmentDescription, goal } = req.body;
    const suggestion = await suggestChannel(segmentDescription || 'general customers', goal || 'drive purchases');
    res.json(suggestion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/conversation/:sessionId
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const messages = await prisma.aiConversation.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
