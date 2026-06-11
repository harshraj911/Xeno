import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Rule structure:
 * {
 *   operator: 'AND' | 'OR',
 *   conditions: [
 *     { field: 'totalSpend', op: 'gte', value: 1000 },
 *     { field: 'orderCount', op: 'lte', value: 5 },
 *     { field: 'lastOrderAt', op: 'daysAgo_lte', value: 30 },
 *     { field: 'tags', op: 'contains', value: 'vip' },
 *     { field: 'city', op: 'eq', value: 'Mumbai' },
 *     ...
 *   ]
 * }
 */

const FIELD_MAP = {
  totalSpend: 'totalSpend',
  orderCount: 'orderCount',
  avgOrderValue: 'avgOrderValue',
  lastOrderAt: 'lastOrderAt',
  firstOrderAt: 'firstOrderAt',
  city: 'city',
  country: 'country',
  tags: 'tags',
  isActive: 'isActive',
  channel: 'channel'
};

function buildWhereClause(rules) {
  const { operator, conditions } = rules;

  const clauses = conditions.map((cond) => {
    const { field, op, value } = cond;

    switch (op) {
      case 'eq':
        return { [field]: { equals: value } };

      case 'neq':
        return { [field]: { not: value } };

      case 'gt':
        return { [field]: { gt: Number(value) } };

      case 'gte':
        return { [field]: { gte: Number(value) } };

      case 'lt':
        return { [field]: { lt: Number(value) } };

      case 'lte':
        return { [field]: { lte: Number(value) } };

      case 'daysAgo_gte': {
        const d = new Date();
        d.setDate(d.getDate() - Number(value));
        return { [field]: { gte: d } };
      }

      case 'daysAgo_lte': {
        const d = new Date();
        d.setDate(d.getDate() - Number(value));
        return { [field]: { lte: d } };
      }

      case 'daysAgo_between': {
        const [minDays, maxDays] = value;
        const minDate = new Date();
        const maxDate = new Date();
        minDate.setDate(minDate.getDate() - Number(maxDays));
        maxDate.setDate(maxDate.getDate() - Number(minDays));
        return { [field]: { gte: minDate, lte: maxDate } };
      }

      case 'contains':
        if (field === 'tags') {
          return { tags: { has: value } };
        }
        return { [field]: { contains: value, mode: 'insensitive' } };

      case 'not_contains':
        if (field === 'tags') {
          return { NOT: { tags: { has: value } } };
        }
        return { NOT: { [field]: { contains: value, mode: 'insensitive' } } };

      case 'in':
        return { [field]: { in: Array.isArray(value) ? value : [value] } };

      case 'not_in':
        return { [field]: { notIn: Array.isArray(value) ? value : [value] } };

      case 'is_null':
        return { [field]: null };

      case 'is_not_null':
        return { [field]: { not: null } };

      default:
        logger.warn(`Unknown operator: ${op}`);
        return {};
    }
  });

  return operator === 'AND' ? { AND: clauses } : { OR: clauses };
}

export async function evaluateSegment(rules) {
  try {
    const where = buildWhereClause(rules);
    const customers = await prisma.customer.findMany({
      where,
      select: { id: true }
    });
    return customers.map((c) => c.id);
  } catch (err) {
    logger.error('Segment evaluation error:', err);
    throw err;
  }
}

export async function countSegment(rules) {
  try {
    const where = buildWhereClause(rules);
    return await prisma.customer.count({ where });
  } catch (err) {
    logger.error('Segment count error:', err);
    throw err;
  }
}

export async function refreshSegmentMembers(segmentId) {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) throw new Error('Segment not found');

  const customerIds = await evaluateSegment(segment.rules);

  // Transactionally replace members
  await prisma.$transaction(async (tx) => {
    await tx.segmentMember.deleteMany({ where: { segmentId } });

    if (customerIds.length > 0) {
      await tx.segmentMember.createMany({
        data: customerIds.map((customerId) => ({ segmentId, customerId })),
        skipDuplicates: true
      });
    }

    await tx.segment.update({
      where: { id: segmentId },
      data: {
        customerCount: customerIds.length,
        lastCalculated: new Date()
      }
    });
  });

  return customerIds.length;
}
