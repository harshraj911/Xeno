import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { dispatchCampaign } from '../services/campaignDispatcher.js';
import { generateCampaignMessage, generateCampaignInsights, suggestChannel } from '../services/groqService.js';
import { refreshSegmentMembers } from '../services/segmentEngine.js';
import { cache } from '../utils/redis.js';

const router = Router();

// GET /api/campaigns
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          segment: { select: { id: true, name: true, customerCount: true } },
          _count: { select: { communications: true } }
        }
      }),
      prisma.campaign.count({ where })
    ]);

    res.json({
      data: campaigns,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', async (req, res) => {
  try {
    const count = await prisma.campaign.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        segment: { select: { id: true, name: true, customerCount: true, rules: true } },
        communications: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { id: true, name: true, email: true } } }
        }
      }
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, status: true, channel: true,
        totalSent: true, totalDelivered: true, totalFailed: true,
        totalOpened: true, totalClicked: true, totalRead: true, totalConverted: true,
        startedAt: true, completedAt: true
      }
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Status breakdown
    const statusBreakdown = await prisma.communication.groupBy({
      by: ['status'],
      where: { campaignId: req.params.id },
      _count: { id: true }
    });

    const deliveryRate = campaign.totalSent > 0
      ? ((campaign.totalDelivered / campaign.totalSent) * 100).toFixed(1)
      : 0;
    const openRate = campaign.totalDelivered > 0
      ? ((campaign.totalOpened / campaign.totalDelivered) * 100).toFixed(1)
      : 0;
    const clickRate = campaign.totalOpened > 0
      ? ((campaign.totalClicked / campaign.totalOpened) * 100).toFixed(1)
      : 0;

    res.json({
      ...campaign,
      deliveryRate: Number(deliveryRate),
      openRate: Number(openRate),
      clickRate: Number(clickRate),
      statusBreakdown: statusBreakdown.reduce((acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      }, {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns - create campaign
router.post('/',
  [
    body('name').trim().notEmpty(),
    body('segmentId').notEmpty(),
    body('channel').isIn(['whatsapp', 'sms', 'email', 'rcs']),
    body('messageTemplate').trim().notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const campaign = await prisma.campaign.create({ data: req.body });
      await cache.del('analytics:dashboard');
      res.status(201).json(campaign);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/campaigns/ai-create - full AI campaign creation
router.post('/ai-create', async (req, res) => {
  try {
    const { intent, segmentId, channel: requestedChannel } = req.body;
    if (!intent || !segmentId) {
      return res.status(400).json({ error: 'intent and segmentId are required' });
    }

    const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });

    // If no channel specified, suggest one
    let channel = requestedChannel;
    let channelReason = null;
    if (!channel) {
      const suggestion = await suggestChannel(segment.description || segment.name, intent);
      channel = suggestion.channel;
      channelReason = suggestion.reason;
    }

    // Generate message
    const message = await generateCampaignMessage(intent, channel, segment.description || segment.name);

    res.json({
      name: `AI Campaign - ${new Date().toLocaleDateString()}`,
      segmentId,
      channel,
      messageTemplate: message,
      channelReason,
      aiGenerated: true,
      aiPrompt: intent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/ai-message - generate message only
router.post('/ai-message', async (req, res) => {
  try {
    const { intent, channel, segmentDescription } = req.body;
    if (!intent || !channel) return res.status(400).json({ error: 'intent and channel required' });

    const message = await generateCampaignMessage(intent, channel, segmentDescription || 'general audience');
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/launch - launch campaign
router.post('/:id/launch', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!['draft', 'paused'].includes(campaign.status)) {
      return res.status(400).json({ error: `Cannot launch campaign in ${campaign.status} status` });
    }

    // Refresh segment members before dispatch
    await refreshSegmentMembers(campaign.segmentId);

    // Update campaign status
    await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'running', startedAt: new Date() }
    });

    // Dispatch
    await dispatchCampaign(req.params.id);

    await cache.del('analytics:dashboard');

    res.json({ launched: true, campaignId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'paused' }
    });
    await cache.del('analytics:dashboard');
    res.json({ paused: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/insights - AI-generated insights
router.get('/:id/insights', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { segment: { select: { name: true } } }
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    if (campaign.totalSent === 0) {
      return res.json({ insights: 'Campaign has not been sent yet. Launch it to see performance insights.' });
    }

    const insights = await generateCampaignInsights({
      name: campaign.name,
      channel: campaign.channel,
      segment: campaign.segment.name,
      sent: campaign.totalSent,
      delivered: campaign.totalDelivered,
      failed: campaign.totalFailed,
      opened: campaign.totalOpened,
      clicked: campaign.totalClicked,
      converted: campaign.totalConverted,
      deliveryRate: campaign.totalSent > 0 ? ((campaign.totalDelivered / campaign.totalSent) * 100).toFixed(1) : 0,
      openRate: campaign.totalDelivered > 0 ? ((campaign.totalOpened / campaign.totalDelivered) * 100).toFixed(1) : 0
    });

    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
