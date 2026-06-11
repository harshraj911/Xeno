import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';

const router = Router();

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, customerId, status, minAmount, maxAmount } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (minAmount) where.amount = { ...where.amount, gte: Number(minAmount) };
    if (maxAmount) where.amount = { ...where.amount, lte: Number(maxAmount) };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { orderedAt: 'desc' },
        include: { customer: { select: { id: true, name: true, email: true } } }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      data: orders,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
router.post('/',
  [
    body('customerId').notEmpty(),
    body('amount').isFloat({ min: 0 }),
    body('status').optional().isIn(['pending', 'completed', 'cancelled', 'refunded'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({ data: req.body });

        // Recompute customer aggregates
        const agg = await tx.order.aggregate({
          where: { customerId: req.body.customerId, status: 'completed' },
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true },
          _min: { orderedAt: true },
          _max: { orderedAt: true }
        });

        await tx.customer.update({
          where: { id: req.body.customerId },
          data: {
            totalSpend: agg._sum.amount || 0,
            orderCount: agg._count.id || 0,
            avgOrderValue: agg._avg.amount || 0,
            firstOrderAt: agg._min.orderedAt,
            lastOrderAt: agg._max.orderedAt
          }
        });

        return newOrder;
      });

      res.status(201).json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/orders/stats
router.get('/stats/overview', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, thisMonth, lastMonth, byStatus, revenueByDay] = await Promise.all([
      prisma.order.aggregate({ _sum: { amount: true }, _count: { id: true } }),
      prisma.order.aggregate({
        where: { orderedAt: { gte: monthStart } },
        _sum: { amount: true }, _count: { id: true }
      }),
      prisma.order.aggregate({
        where: { orderedAt: { gte: lastMonthStart, lt: monthStart } },
        _sum: { amount: true }, _count: { id: true }
      }),
      prisma.order.groupBy({
        by: ['status'], _count: { id: true }, _sum: { amount: true }
      }),
      prisma.$queryRaw`
        SELECT DATE(ordered_at) as date, SUM(amount)::float as revenue, COUNT(*)::int as orders
        FROM orders
        WHERE ordered_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(ordered_at)
        ORDER BY date ASC
      `
    ]);

    res.json({
      totalRevenue: total._sum.amount || 0,
      totalOrders: total._count.id,
      thisMonthRevenue: thisMonth._sum.amount || 0,
      thisMonthOrders: thisMonth._count.id,
      lastMonthRevenue: lastMonth._sum.amount || 0,
      revenueGrowth: lastMonth._sum.amount
        ? (((thisMonth._sum.amount || 0) - lastMonth._sum.amount) / lastMonth._sum.amount * 100).toFixed(1)
        : null,
      byStatus,
      revenueByDay
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', async (req, res) => {
  try {
    const count = await prisma.order.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
