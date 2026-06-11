import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { cache } from '../utils/redis.js';
import { evaluateSegment, refreshSegmentMembers, countSegment } from '../services/segmentEngine.js';
import { generateSegmentRules } from '../services/groqService.js';

const router = Router();

// GET /api/segments
router.get('/', async (req, res) => {
  try {
    const segments = await prisma.segment.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { campaigns: true, members: true } }
      }
    });
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', async (req, res) => {
  try {
    const count = await prisma.segment.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/segments/:id
router.get('/:id', async (req, res) => {
  try {
    const segment = await prisma.segment.findUnique({
      where: { id: req.params.id },
      include: {
        campaigns: { orderBy: { createdAt: 'desc' }, take: 5 },
        _count: { select: { members: true } }
      }
    });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    res.json(segment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/segments/:id/members
router.get('/:id/members', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [members, total] = await Promise.all([
      prisma.segmentMember.findMany({
        where: { segmentId: req.params.id },
        skip, take: Number(limit),
        include: { customer: true },
        orderBy: { addedAt: 'desc' }
      }),
      prisma.segmentMember.count({ where: { segmentId: req.params.id } })
    ]);

    res.json({
      data: members.map((m) => m.customer),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments - create manual segment
router.post('/',
  [
    body('name').trim().notEmpty(),
    body('rules').isObject(),
    body('rules.operator').isIn(['AND', 'OR']),
    body('rules.conditions').isArray({ min: 1 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, description, rules } = req.body;

      // Preview count before saving
      const count = await countSegment(rules);

      const segment = await prisma.segment.create({
        data: { name, description, rules, customerCount: count }
      });

      // Populate members asynchronously
      refreshSegmentMembers(segment.id).catch((err) => {
        console.error('Background segment refresh failed:', err);
      });

      res.status(201).json({ ...segment, estimatedCount: count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/segments/ai-generate - AI-powered segment from natural language
router.post('/ai-generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Get DB stats for context
    const stats = await prisma.customer.aggregate({
      _avg: { totalSpend: true, orderCount: true },
      _max: { totalSpend: true, orderCount: true },
      _min: { totalSpend: true },
      _count: { id: true }
    });

    const generated = await generateSegmentRules(prompt, {
      totalCustomers: stats._count.id,
      avgSpend: Math.round(stats._avg.totalSpend || 0),
      maxSpend: Math.round(stats._max.totalSpend || 0),
      avgOrders: Math.round(stats._avg.orderCount || 0),
      maxOrders: stats._max.orderCount || 0
    });

    // Count matching customers
    const count = await countSegment(generated.rules);

    res.json({ ...generated, estimatedCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments/preview - preview count without saving
router.post('/preview', async (req, res) => {
  try {
    const { rules } = req.body;
    if (!rules) return res.status(400).json({ error: 'Rules required' });

    const count = await countSegment(rules);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments/:id/refresh - recalculate segment members
router.post('/:id/refresh', async (req, res) => {
  try {
    const count = await refreshSegmentMembers(req.params.id);
    res.json({ count, refreshed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/segments/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, rules } = req.body;
    const segment = await prisma.segment.update({
      where: { id: req.params.id },
      data: { name, description, ...(rules && { rules }) }
    });

    if (rules) {
      refreshSegmentMembers(req.params.id).catch(() => {});
    }

    res.json(segment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/segments/:id (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.segment.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
