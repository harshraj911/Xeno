import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Valid status transitions
const STATUS_TRANSITIONS = {
  sent: ['delivered', 'failed'],
  delivered: ['opened', 'read', 'clicked', 'converted', 'failed'],
  opened: ['read', 'clicked', 'converted'],
  read: ['clicked', 'converted'],
  clicked: ['converted']
};

const STATUS_TIMESTAMP_MAP = {
  delivered: 'deliveredAt',
  opened: 'openedAt',
  read: 'readAt',
  clicked: 'clickedAt',
  converted: 'convertedAt',
  failed: 'failedAt'
};

const CAMPAIGN_COUNT_MAP = {
  delivered: 'totalDelivered',
  opened: 'totalOpened',
  read: 'totalRead',
  clicked: 'totalClicked',
  converted: 'totalConverted',
  failed: 'totalFailed'
};

// POST /api/receipts/callback - called by channel service
router.post('/callback', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    // Process in batches for performance
    const results = await Promise.allSettled(
      events.map((event) => processReceiptEvent(event))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      logger.warn(`Receipt callback: ${succeeded} processed, ${failed} failed`);
    }

    res.json({ processed: succeeded, failed, total: events.length });
  } catch (err) {
    logger.error('Receipt callback error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function processReceiptEvent(event) {
  const { messageId, status, reason, metadata = {} } = event;

  if (!messageId || !status) {
    throw new Error('Invalid event: missing messageId or status');
  }

  const comm = await prisma.communication.findUnique({
    where: { id: messageId },
    select: { id: true, status: true, campaignId: true }
  });

  if (!comm) {
    logger.warn(`Receipt for unknown message: ${messageId}`);
    return;
  }

  // Enforce idempotency - don't re-process same status
  if (comm.status === status) {
    logger.debug(`Idempotent receipt ignored: ${messageId} already ${status}`);
    return;
  }

  // Allow certain status upgrades only
  const timestampField = STATUS_TIMESTAMP_MAP[status];
  const campaignField = CAMPAIGN_COUNT_MAP[status];

  const updateData = {
    status,
    metadata: { ...metadata, lastEvent: status, eventAt: new Date().toISOString() }
  };

  if (timestampField) updateData[timestampField] = new Date();
  if (status === 'failed' && reason) updateData.failureReason = reason;

  await prisma.$transaction(async (tx) => {
    await tx.communication.update({
      where: { id: messageId },
      data: updateData
    });

    // Update campaign aggregate counters
    if (campaignField) {
      await tx.campaign.update({
        where: { id: comm.campaignId },
        data: { [campaignField]: { increment: 1 } }
      });
    }

    // Check if campaign is fully delivered
    const campaign = await tx.campaign.findUnique({
      where: { id: comm.campaignId },
      select: { status: true, totalSent: true, totalDelivered: true, totalFailed: true }
    });

    if (campaign && campaign.status === 'running') {
      const processed = campaign.totalDelivered + campaign.totalFailed;
      if (processed >= campaign.totalSent && campaign.totalSent > 0) {
        await tx.campaign.update({
          where: { id: comm.campaignId },
          data: { status: 'completed', completedAt: new Date() }
        });
        logger.info(`Campaign ${comm.campaignId} marked as completed`);
      }
    }
  });

  logger.debug(`Receipt processed: ${messageId} -> ${status}`);
}

// GET /api/receipts/campaign/:id - get all receipts for a campaign
router.get('/campaign/:id', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { campaignId: req.params.id };
    if (status) where.status = status;

    const [comms, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
        include: { customer: { select: { id: true, name: true, email: true } } }
      }),
      prisma.communication.count({ where })
    ]);

    res.json({
      data: comms,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
