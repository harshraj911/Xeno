import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { cache } from '../utils/redis.js';

const router = Router();

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'createdAt', order = 'desc', city, minSpend, maxSpend, tags } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (minSpend) where.totalSpend = { ...where.totalSpend, gte: Number(minSpend) };
    if (maxSpend) where.totalSpend = { ...where.totalSpend, lte: Number(maxSpend) };
    if (tags) where.tags = { hasSome: tags.split(',') };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: order },
        include: {
          _count: { select: { orders: true, communications: true } }
        }
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      data: customers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/stats/overview  ← MUST be before /:id
router.get('/stats/overview', async (req, res) => {
  const cacheKey = 'customer:stats:overview';

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [total, active, topCities, spendStats] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.groupBy({
        by: ['city'],
        _count: { city: true },
        where: { city: { not: null } },
        orderBy: { _count: { city: 'desc' } },
        take: 5
      }),
      prisma.customer.aggregate({
        _avg: { totalSpend: true, orderCount: true },
        _max: { totalSpend: true },
        _sum: { totalSpend: true }
      })
    ]);

    const result = {
      total,
      active,
      topCities: topCities.map((c) => ({ city: c.city, count: c._count.city })),
      avgSpend: Math.round(spendStats._avg.totalSpend || 0),
      avgOrders: Math.round(spendStats._avg.orderCount || 0),
      totalRevenue: Math.round(spendStats._sum.totalSpend || 0),
      topSpend: Math.round(spendStats._max.totalSpend || 0)
    };

    await cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', async (req, res) => {
  try {
    const count = await prisma.customer.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: { orderBy: { orderedAt: 'desc' }, take: 20 },
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { campaign: { select: { name: true } } }
        }
      }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('city').optional().trim(),
    body('channel').optional().isIn(['whatsapp', 'sms', 'email', 'rcs'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const customer = await prisma.customer.create({ data: req.body });
      res.status(201).json(customer);
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' });
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH /api/customers/:id
router.patch('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(customer);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Customer not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id/timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const [orders, comms] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: req.params.id },
        orderBy: { orderedAt: 'desc' }
      }),
      prisma.communication.findMany({
        where: { customerId: req.params.id },
        orderBy: { createdAt: 'desc' },
        include: { campaign: { select: { name: true, channel: true } } }
      })
    ]);

    const timeline = [
      ...orders.map((o) => ({ type: 'order', date: o.orderedAt, data: o })),
      ...comms.map((c) => ({ type: 'communication', date: c.createdAt, data: c }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// (stats/overview route moved above /:id to prevent routing conflict)


export default router;
