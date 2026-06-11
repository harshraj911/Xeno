import Groq from 'groq-sdk';
import { logger } from '../utils/logger.js';

// ─────────────────────────────────────────────
//  Provider config
//  Priority: tries GROQ first, falls back to
//  NVIDIA NIM if Groq hits rate limit (429)
//  or if GROQ_API_KEY is not set.
// ─────────────────────────────────────────────

const GROQ_KEY    = process.env.GROQ_API_KEY;
const NVIDIA_KEY  = process.env.NVIDIA_API_KEY;

// NVIDIA NIM uses an OpenAI-compatible endpoint
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL    = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';

// Groq model
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';

// Which providers are actually available
const hasGroq   = !!GROQ_KEY;
const hasNvidia = !!NVIDIA_KEY;

if (!hasGroq && !hasNvidia) {
  logger.warn('⚠️  No AI provider configured! Set GROQ_API_KEY or NVIDIA_API_KEY in .env');
}

// Lazy-init clients so missing keys don't crash at startup
let _groqClient = null;
function getGroq() {
  if (!_groqClient && hasGroq) {
    _groqClient = new Groq({ apiKey: GROQ_KEY });
  }
  return _groqClient;
}

// NVIDIA uses the same OpenAI-compat SDK shape as Groq (both expose .chat.completions.create)
let _nvidiaClient = null;
function getNvidia() {
  if (!_nvidiaClient && hasNvidia) {
    // Groq SDK is just a thin OpenAI-compat wrapper — works fine pointed at NVIDIA NIM
    _nvidiaClient = new Groq({
      apiKey: NVIDIA_KEY,
      baseURL: NVIDIA_BASE_URL
    });
  }
  return _nvidiaClient;
}

// ─────────────────────────────────────────────
//  Retry/fallback helpers
// ─────────────────────────────────────────────

function isRateLimitError(err) {
  return (
    err?.status === 429 ||
    err?.statusCode === 429 ||
    err?.message?.toLowerCase().includes('rate limit') ||
    err?.message?.toLowerCase().includes('too many requests')
  );
}

function isAuthError(err) {
  return err?.status === 401 || err?.status === 403;
}

/**
 * Try Groq first, fallback to NVIDIA on 429 or if Groq unavailable.
 * For non-rate-limit errors (e.g. 500) we still try the other provider.
 */
async function callWithFallback(groqFn, nvidiaFn) {
  // --- Try Groq ---
  if (hasGroq) {
    try {
      return await groqFn(getGroq(), GROQ_MODEL);
    } catch (err) {
      if (isAuthError(err)) {
        logger.error('Groq auth error — check GROQ_API_KEY');
        // Don't fallback on auth errors
        throw err;
      }
      if (isRateLimitError(err)) {
        logger.warn('Groq rate limit hit — falling back to NVIDIA NIM');
      } else {
        logger.warn(`Groq error (${err?.status || err?.message}) — trying NVIDIA NIM`);
      }
      // Fall through to NVIDIA
    }
  }

  // --- Try NVIDIA ---
  if (hasNvidia) {
    try {
      return await nvidiaFn(getNvidia(), NVIDIA_MODEL);
    } catch (err) {
      logger.error('NVIDIA NIM error:', err?.message);
      throw err;
    }
  }

  throw new Error(
    'No AI provider available. Set GROQ_API_KEY or NVIDIA_API_KEY in your .env file.'
  );
}

// ─────────────────────────────────────────────
//  Core completion (non-streaming)
// ─────────────────────────────────────────────

async function complete(messages, options = {}) {
  const params = {
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.maxTokens  ?? 1024
  };

  const result = await callWithFallback(
    async (client, model) => {
      const res = await client.chat.completions.create({ model, ...params });
      return res.choices[0]?.message?.content || '';
    },
    async (client, model) => {
      const res = await client.chat.completions.create({ model, ...params });
      return res.choices[0]?.message?.content || '';
    }
  );

  return result;
}

// ─────────────────────────────────────────────
//  Streaming completion
//  NVIDIA NIM supports streaming too (same API)
// ─────────────────────────────────────────────

export async function streamComplete(messages, options = {}) {
  const params = {
    messages,
    stream:      true,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.maxTokens  ?? 1024
  };

  // For streaming we still try Groq first; on rate-limit switch to NVIDIA.
  // We return the stream object directly — callers do `for await (const chunk of stream)`.

  if (hasGroq) {
    try {
      const stream = await getGroq().chat.completions.create({
        model: GROQ_MODEL, ...params
      });
      return stream;
    } catch (err) {
      if (isAuthError(err)) throw err;
      logger.warn(`Groq stream error — falling back to NVIDIA: ${err?.message}`);
    }
  }

  if (hasNvidia) {
    const stream = await getNvidia().chat.completions.create({
      model: NVIDIA_MODEL, ...params
    });
    return stream;
  }

  throw new Error('No AI provider available for streaming.');
}

// ─────────────────────────────────────────────
//  Active provider helper (for UI display)
// ─────────────────────────────────────────────

export function getActiveProviders() {
  return {
    groq:   hasGroq,
    nvidia: hasNvidia,
    primary: hasGroq ? 'Groq' : hasNvidia ? 'NVIDIA NIM' : 'None'
  };
}

// ─────────────────────────────────────────────
//  Business functions (unchanged logic)
// ─────────────────────────────────────────────

export async function generateSegmentRules(prompt, stats) {
  const systemPrompt = `You are an expert CRM analyst for a consumer brand. Convert natural language audience descriptions into structured segment rules.

Available fields and operators:
- totalSpend: gte, lte, gt, lt, eq (numeric, in INR)
- orderCount: gte, lte, gt, lt, eq (integer)
- avgOrderValue: gte, lte, gt, lt (numeric)
- lastOrderAt: daysAgo_gte (inactive for X days), daysAgo_lte (active within X days), daysAgo_between ([min, max])
- firstOrderAt: daysAgo_gte, daysAgo_lte
- city: eq, neq, in, not_in (string)
- country: eq, neq (string, default "IN")
- tags: contains, not_contains (string)
- channel: eq, in (whatsapp, sms, email, rcs)
- isActive: eq (boolean)

Current database stats:
${JSON.stringify(stats, null, 2)}

Return ONLY a valid JSON object with this structure:
{
  "name": "Segment name",
  "description": "What this segment represents",
  "rules": {
    "operator": "AND" or "OR",
    "conditions": [
      { "field": "fieldName", "op": "operator", "value": value }
    ]
  }
}

No explanation, no markdown, just the JSON.`;

  try {
    const result = await complete([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: prompt }
    ], { temperature: 0.3, maxTokens: 800 });

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error('AI segment generation failed:', err);
    throw new Error('Failed to generate segment from AI');
  }
}

export async function generateCampaignMessage(intent, channel, segmentDescription, brand = 'our brand') {
  const channelGuidelines = {
    whatsapp: 'WhatsApp message: conversational, max 300 chars, can use emojis, include a clear CTA. Use {{name}} for personalization.',
    sms:      'SMS: max 160 chars, no emojis, include opt-out info like "Reply STOP", business name at start.',
    email:    'Email body: can be 2-3 sentences, professional yet warm, include {{name}}, clear subject implied.',
    rcs:      'RCS message: rich format supported, can be slightly longer, conversational, include CTA button text in [brackets].'
  };

  const systemPrompt = `You are a marketing copywriter for ${brand}. Create personalized campaign messages.

Channel guidelines: ${channelGuidelines[channel] || channelGuidelines.whatsapp}

Target audience: ${segmentDescription}

Use {{name}} for customer name personalization. Keep the message authentic and on-brand.
Return ONLY the message text, no explanation.`;

  try {
    const result = await complete([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `Create a message for: ${intent}` }
    ], { temperature: 0.8, maxTokens: 300 });

    return result.trim();
  } catch (err) {
    logger.error('AI message generation failed:', err);
    throw new Error('Failed to generate message from AI');
  }
}

export async function generateCampaignInsights(campaignData) {
  const systemPrompt = `You are a senior marketing analyst. Analyze campaign performance data and provide actionable insights.

Focus on:
1. What worked well
2. What underperformed and why
3. Audience quality signals
4. Specific recommendations for the next campaign

Be concise, specific, and data-driven. Use bullet points. Max 200 words.`;

  try {
    const result = await complete([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `Analyze this campaign data:\n${JSON.stringify(campaignData, null, 2)}` }
    ], { temperature: 0.4, maxTokens: 400 });

    return result.trim();
  } catch (err) {
    logger.error('AI insights generation failed:', err);
    return 'Unable to generate insights at this time.';
  }
}

export async function chatWithAssistant(messages, context) {
  const systemPrompt = `You are Xeno AI, an intelligent CRM assistant for ${context.brandName || 'this brand'}.

Current CRM state:
- Total customers: ${context.totalCustomers || 0}
- Total campaigns: ${context.totalCampaigns || 0}
- Active segments: ${context.activeSegments || 0}
- Revenue this month: ₹${(context.monthlyRevenue || 0).toLocaleString('en-IN')}

You can help with:
- Identifying audience segments ("find customers who haven't ordered in 60 days")
- Campaign strategy and message writing
- Performance analysis and recommendations
- Data insights and trends

When suggesting segments or campaigns, be specific with numbers and criteria.
Be conversational but professional. Keep responses concise.`;

  try {
    const stream = await streamComplete([
      { role: 'system', content: systemPrompt },
      ...messages
    ], { temperature: 0.6, maxTokens: 600 });

    return stream;
  } catch (err) {
    logger.error('AI chat failed:', err);
    throw new Error('AI assistant unavailable');
  }
}

export async function suggestChannel(segmentDescription, campaignGoal) {
  const systemPrompt = `You are a CRM channel strategy expert. Recommend the best messaging channel.
Available channels: whatsapp (highest engagement, rich media), sms (high deliverability, simple), email (detailed content, lower open rates), rcs (rich interactive, limited reach).
Return JSON: { "channel": "...", "reason": "...", "expectedOpenRate": "..." }
No markdown, just JSON.`;

  try {
    const result = await complete([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `Segment: ${segmentDescription}\nGoal: ${campaignGoal}` }
    ], { temperature: 0.3, maxTokens: 200 });

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { channel: 'whatsapp', reason: 'Default recommendation', expectedOpenRate: '45-65%' };
  }
}
