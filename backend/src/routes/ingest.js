import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/redis.js';

const router = Router();

// POST /api/ingest/customers - bulk customer import
router.post('/customers', async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'customers array required' });
    }
    if (customers.length > 10000) {
      return res.status(400).json({ error: 'Max 10,000 customers per batch' });
    }

    const BATCH_SIZE = 500;
    let created = 0, skipped = 0;

    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);
      try {
        const result = await prisma.customer.createMany({
          data: batch.map((c) => ({
            name: c.name,
            email: c.email.toLowerCase().trim(),
            phone: c.phone,
            city: c.city,
            country: c.country || 'IN',
            channel: c.channel || 'email',
            tags: c.tags || [],
            totalSpend: c.totalSpend || 0,
            orderCount: c.orderCount || 0
          })),
          skipDuplicates: true
        });
        created += result.count;
        skipped += batch.length - result.count;
      } catch (err) {
        logger.error(`Batch ${i}-${i + BATCH_SIZE} failed:`, err.message);
        skipped += batch.length;
      }
    }

    res.json({ created, skipped, total: customers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest/orders - bulk order import
router.post('/orders', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'orders array required' });
    }

    const BATCH_SIZE = 500;
    let created = 0, skipped = 0;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      try {
        const result = await prisma.order.createMany({
          data: batch.map((o) => ({
            customerId: o.customerId,
            amount: Number(o.amount),
            status: o.status || 'completed',
            channel: o.channel || 'online',
            category: o.category,
            items: o.items || [],
            orderedAt: o.orderedAt ? new Date(o.orderedAt) : new Date()
          })),
          skipDuplicates: true
        });
        created += result.count;
      } catch (err) {
        logger.error('Order batch error:', err.message);
        skipped += batch.length;
      }
    }

    // Recompute customer aggregates in background
    recomputeCustomerAggregates().catch((e) => logger.error('Aggregate recompute failed:', e));

    res.json({ created, skipped, total: orders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest/seed - seed with realistic demo data
router.post('/seed', async (req, res) => {
  try {
    const existing = await prisma.customer.count();
    if (existing > 0) {
      return res.status(409).json({ error: 'Data already exists. Delete first.' });
    }
    const { count = 500 } = req.body;
    await seedDemoData(Math.min(count, 2000));
    await cache.del('analytics:dashboard');
    res.json({ seeded: true, message: `Demo data seeded with ${count} customers` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ingest/clear - clear all demo data
router.delete('/clear', async (req, res) => {
  try {
    // Order matters because of foreign keys
    await prisma.communication.deleteMany();
    await prisma.order.deleteMany();
    await prisma.segmentMember.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.segment.deleteMany();
    await prisma.customer.deleteMany();

    await cache.invalidatePattern('analytics:*');
    await cache.invalidatePattern('customer:*');

    res.json({ cleared: true, message: 'All data has been wiped.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function recomputeCustomerAggregates() {
  const result = await prisma.$executeRaw`
    UPDATE customers c
    SET
      total_spend = COALESCE(agg.total, 0),
      order_count = COALESCE(agg.cnt, 0),
      avg_order_value = COALESCE(agg.avg, 0),
      first_order_at = agg.first_order,
      last_order_at = agg.last_order,
      updated_at = NOW()
    FROM (
      SELECT
        customer_id,
        SUM(amount) as total,
        COUNT(*) as cnt,
        AVG(amount) as avg,
        MIN(ordered_at) as first_order,
        MAX(ordered_at) as last_order
      FROM orders
      WHERE status = 'completed'
      GROUP BY customer_id
    ) agg
    WHERE c.id = agg.customer_id
  `;
  logger.info(`Recomputed aggregates for ${result} customers`);
}

async function seedDemoData(count = 500) {
  const indianNames = ['Priya Sharma', 'Rahul Gupta', 'Ananya Singh', 'Vikram Patel', 'Neha Mehta',
    'Arjun Reddy', 'Kavya Nair', 'Rohit Kumar', 'Divya Joshi', 'Amit Verma', 'Sneha Rao',
    'Karan Malhotra', 'Pooja Iyer', 'Suresh Pillai', 'Meera Krishnan', 'Aditya Shah',
    'Riya Chatterjee', 'Nikhil Banerjee', 'Swati Mishra', 'Deepak Tiwari'];
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];
  const channels = ['whatsapp', 'email', 'sms', 'rcs'];
  const categories = ['Electronics', 'Fashion', 'Beauty', 'Home', 'Food', 'Sports', 'Books'];

  const customers = Array.from({ length: count }, (_, i) => {
    const name = indianNames[Math.floor(Math.random() * indianNames.length)];
    const nameParts = name.toLowerCase().split(' ');
    const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    return {
      name,
      email: `${nameParts[0]}.${nameParts[1]}${i}@${emailDomains[Math.floor(Math.random() * emailDomains.length)]}`,
      phone: `+91${Math.floor(7000000000 + Math.random() * 3000000000)}`,
      city: cities[Math.floor(Math.random() * cities.length)],
      country: 'IN',
      channel: channels[Math.floor(Math.random() * channels.length)],
      tags: Math.random() > 0.7 ? ['vip'] : Math.random() > 0.5 ? ['regular'] : [],
      isActive: Math.random() > 0.1
    };
  });

  await prisma.customer.createMany({ data: customers, skipDuplicates: true });
  const createdCustomers = await prisma.customer.findMany({ select: { id: true }, take: count });

  // Generate orders
  const orders = [];
  for (const customer of createdCustomers) {
    const orderCount = Math.floor(Math.random() * 12);
    for (let j = 0; j < orderCount; j++) {
      const daysAgo = Math.floor(Math.random() * 365);
      orders.push({
        customerId: customer.id,
        amount: Math.floor(200 + Math.random() * 9800),
        status: Math.random() > 0.05 ? 'completed' : 'cancelled',
        channel: Math.random() > 0.5 ? 'online' : 'offline',
        category: categories[Math.floor(Math.random() * categories.length)],
        orderedAt: new Date(Date.now() - daysAgo * 86400000)
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < orders.length; i += BATCH) {
    await prisma.order.createMany({ data: orders.slice(i, i + BATCH), skipDuplicates: true });
  }

  await recomputeCustomerAggregates();

  // Seed sample segments
  const vipSegment = await prisma.segment.create({
    data: {
      name: 'VIP Customers',
      description: 'High spenders (> ₹50,000)',
      rules: { conditions: [{ field: 'totalSpend', op: 'gte', value: 50000 }] },
      customerCount: Math.floor(count * 0.1),
      isActive: true
    }
  });

  const inactiveSegment = await prisma.segment.create({
    data: {
      name: 'Inactive (30d)',
      description: 'Customers with no recent activity',
      rules: { conditions: [{ field: 'lastOrderAt', op: 'daysAgo_gte', value: 30 }] },
      customerCount: Math.floor(count * 0.2),
      isActive: true
    }
  });

  // Seed sample campaigns
  await prisma.campaign.createMany({
    data: [
      {
        name: 'Summer Sale 2026',
        segmentId: vipSegment.id,
        channel: 'whatsapp',
        status: 'running',
        messageTemplate: 'Hi {{name}}, enjoy our exclusive Summer Sale!',
        totalSent: 100,
        totalDelivered: 98,
        totalOpened: 45,
        startedAt: new Date()
      },
      {
        name: 'React Order Fallback',
        segmentId: inactiveSegment.id,
        channel: 'email',
        status: 'completed',
        messageTemplate: 'We miss you! Here is a 20% discount.',
        totalSent: 200,
        totalDelivered: 195,
        totalOpened: 120,
        startedAt: new Date(Date.now() - 7 * 86400000),
        completedAt: new Date()
      }
    ]
  });

  logger.info(`Seeded ${count} customers, segments, and campaigns.`);
}

export default router;
