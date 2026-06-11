import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { cache } from '../utils/redis.js';

const router = Router();

// GET /api/analytics/dashboard - main dashboard data
router.get('/dashboard', async (req, res) => {
  const cacheKey = 'analytics:dashboard';
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      customerStats,
      campaignStats,
      recentCampaigns,
      commStats,
      revenueThisMonth,
      revenueLastMonth,
      newCustomersThisMonth,
      newCustomersLastMonth,
      channelBreakdown,
      dailyRevenue
    ] = await Promise.all([
      prisma.customer.aggregate({ _count: { id: true }, _avg: { totalSpend: true } }),
      prisma.campaign.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.campaign.findMany({
        where: { status: { in: ['completed', 'running'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, name: true, status: true, channel: true,
          totalSent: true, totalDelivered: true, totalOpened: true,
          createdAt: true
        }
      }),
      prisma.communication.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.order.aggregate({
        where: { orderedAt: { gte: monthStart }, status: 'completed' },
        _sum: { amount: true }, _count: { id: true }
      }),
      prisma.order.aggregate({
        where: { orderedAt: { gte: lastMonthStart, lt: monthStart }, status: 'completed' },
        _sum: { amount: true }
      }),
      prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.customer.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
      prisma.communication.groupBy({
        by: ['channel'],
        _count: { id: true },
        where: { createdAt: { gte: last30Days } }
      }),
      prisma.$queryRaw`
        SELECT 
          DATE(ordered_at) as date, 
          COALESCE(SUM(amount), 0)::float as revenue,
          COUNT(*)::int as orders
        FROM orders 
        WHERE ordered_at >= NOW() - INTERVAL '30 days'
          AND status = 'completed'
        GROUP BY DATE(ordered_at) 
        ORDER BY date ASC
      `
    ]);

    const totalCampaigns = campaignStats.reduce((sum, s) => sum + s._count.id, 0);
    const activeCampaigns = campaignStats.find((s) => s.status === 'running')?._count.id || 0;

    const totalComms = commStats.reduce((sum, s) => sum + s._count.id, 0);
    const deliveredComms = commStats.find((s) => s.status === 'delivered')?._count.id || 0;
    const openedComms = commStats.find((s) => s.status === 'opened')?._count.id || 0;

    const result = {
      summary: {
        totalCustomers: customerStats._count.id,
        totalCampaigns,
        activeCampaigns,
        avgCustomerSpend: Math.round(customerStats._avg.totalSpend || 0),
        revenueThisMonth: Math.round(revenueThisMonth._sum.amount || 0),
        revenueLastMonth: Math.round(revenueLastMonth._sum.amount || 0),
        revenueGrowth: revenueLastMonth._sum.amount
          ? Number((((revenueThisMonth._sum.amount || 0) - revenueLastMonth._sum.amount) / revenueLastMonth._sum.amount * 100).toFixed(1))
          : null,
        ordersThisMonth: revenueThisMonth._count.id,
        newCustomersThisMonth,
        newCustomersLastMonth,
        customerGrowth: newCustomersLastMonth > 0
          ? Number((((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100).toFixed(1))
          : null
      },
      communications: {
        total: totalComms,
        delivered: deliveredComms,
        opened: openedComms,
        globalDeliveryRate: totalComms > 0 ? Number(((deliveredComms / totalComms) * 100).toFixed(1)) : 0,
        globalOpenRate: deliveredComms > 0 ? Number(((openedComms / deliveredComms) * 100).toFixed(1)) : 0,
        byStatus: commStats.reduce((acc, s) => { acc[s.status] = s._count.id; return acc; }, {})
      },
      recentCampaigns,
      channelBreakdown: channelBreakdown.map((c) => ({
        channel: c.channel,
        count: c._count.id
      })),
      dailyRevenue
    };

    await cache.set(cacheKey, result, 10); // cache 10s
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/campaigns - campaign performance overview
router.get('/campaigns', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const campaigns = await prisma.campaign.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, channel: true, status: true,
        totalSent: true, totalDelivered: true, totalFailed: true,
        totalOpened: true, totalClicked: true, totalConverted: true,
        startedAt: true, completedAt: true, createdAt: true,
        segment: { select: { name: true } }
      }
    });

    const enriched = campaigns.map((c) => ({
      ...c,
      deliveryRate: c.totalSent > 0 ? Number(((c.totalDelivered / c.totalSent) * 100).toFixed(1)) : 0,
      openRate: c.totalDelivered > 0 ? Number(((c.totalOpened / c.totalDelivered) * 100).toFixed(1)) : 0,
      clickRate: c.totalOpened > 0 ? Number(((c.totalClicked / c.totalOpened) * 100).toFixed(1)) : 0
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/segments - segment analytics
router.get('/segments', async (req, res) => {
  try {
    const segments = await prisma.segment.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, customerCount: true, aiGenerated: true,
        lastCalculated: true, createdAt: true,
        _count: { select: { campaigns: true } }
      },
      orderBy: { customerCount: 'desc' }
    });

    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/customers/cohorts - RFM-style cohort
router.get('/customers/cohorts', async (req, res) => {
  try {
    const cacheKey = 'analytics:customer:cohorts';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    // RFM segmentation at the DB level
    const cohorts = await prisma.$queryRaw`
      WITH rfm AS (
        SELECT
          id,
          name,
          EXTRACT(DAY FROM NOW() - last_order_at)::int as recency_days,
          order_count as frequency,
          total_spend as monetary
        FROM customers
        WHERE is_active = true AND last_order_at IS NOT NULL
      ),
      scored AS (
        SELECT *,
          CASE
            WHEN recency_days <= 30 THEN 'Active'
            WHEN recency_days <= 90 THEN 'At Risk'
            WHEN recency_days <= 180 THEN 'Lapsing'
            ELSE 'Churned'
          END as recency_label,
          CASE
            WHEN frequency >= 10 THEN 'High'
            WHEN frequency >= 3 THEN 'Medium'
            ELSE 'Low'
          END as frequency_label,
          CASE
            WHEN monetary >= 10000 THEN 'High'
            WHEN monetary >= 3000 THEN 'Medium'
            ELSE 'Low'
          END as value_label
        FROM rfm
      )
      SELECT
        recency_label,
        frequency_label,
        value_label,
        COUNT(*)::int as count,
        AVG(monetary)::float as avg_spend
      FROM scored
      GROUP BY recency_label, frequency_label, value_label
      ORDER BY count DESC
    `;

    await cache.set(cacheKey, cohorts, 600);
    res.json(cohorts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
