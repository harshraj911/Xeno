import Groq from 'groq-sdk';
import { logger } from '../utils/logger.js';

const GROQ_KEY    = process.env.GROQ_API_KEY;
const NVIDIA_KEY  = process.env.NVIDIA_API_KEY;

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL    = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';

const modelPriority = [
  process.env.GROQ_MODEL,
  'llama3-70b-8192',
  'llama-3.1-70b-versatile',
  'llama-3.3-70b-versatile'
].filter(Boolean);

const GROQ_MODEL = modelPriority[0];
const hasGroq   = !!GROQ_KEY;
const hasNvidia = !!NVIDIA_KEY;

if (!hasGroq && !hasNvidia) {
  logger.warn('⚠️  No AI provider configured! AI features will be disabled.');
}

let _groqClient = null;
function getGroq() {
  if (!_groqClient && hasGroq) _groqClient = new Groq({ apiKey: GROQ_KEY });
  return _groqClient;
}

let _nvidiaClient = null;
function getNvidia() {
  if (!_nvidiaClient && hasNvidia) _nvidiaClient = new Groq({ apiKey: NVIDIA_KEY, baseURL: NVIDIA_BASE_URL });
  return _nvidiaClient;
}

function isRateLimitError(err) {
  return err?.status === 429 || err?.message?.toLowerCase().includes('rate limit');
}

async function callWithFallback(groqFn, nvidiaFn) {
  if (hasGroq) {
    try { return await groqFn(getGroq(), GROQ_MODEL); } 
    catch (err) {
      if (err?.status === 401) throw err;
      logger.warn('Groq error, trying NVIDIA...');
    }
  }
  if (hasNvidia) {
    try { return await nvidiaFn(getNvidia(), NVIDIA_MODEL); } 
    catch (err) { throw err; }
  }
  throw new Error('No AI provider available.');
}

async function complete(messages, options = {}) {
  const params = { messages, temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 2048 };
  return await callWithFallback(
    async (c, m) => (await c.chat.completions.create({ model: m, ...params })).choices[0]?.message?.content || '',
    async (c, m) => (await c.chat.completions.create({ model: m, ...params })).choices[0]?.message?.content || ''
  );
}

export async function streamComplete(messages, options = {}) {
  const params = { messages, stream: true, temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 2048 };
  if (hasGroq) {
    try { return await getGroq().chat.completions.create({ model: GROQ_MODEL, ...params }); } 
    catch (err) { logger.warn('Groq stream error, falling back...'); }
  }
  if (hasNvidia) return await getNvidia().chat.completions.create({ model: NVIDIA_MODEL, ...params });
  throw new Error('No AI provider available.');
}

export function getActiveProviders() {
  return { groq: hasGroq, nvidia: hasNvidia, primary: hasGroq ? 'Groq' : hasNvidia ? 'NVIDIA' : 'None' };
}

export async function generateSegmentRules(prompt, stats) {
  const sys = `Convert audience description to JSON. Stats: ${JSON.stringify(stats)}.
Valid fields: totalSpend, orderCount, city, tags.
Valid ops: gte, lte, eq, contains.
Return only JSON { name, description, rules: { operator: 'AND'|'OR', conditions: [{ field, op, value }] } }`;
  try {
    const res = await complete([{ role: 'system', content: sys }, { role: 'user', content: prompt }], { temperature: 0.1 });
    return JSON.parse(res.replace(/```json|```/g, '').trim());
  } catch (err) { throw new Error('AI segment failed'); }
}

export async function generateCampaignMessage(intent, segmentDescription) {
  const sys = `Expert marketing copywriter. 
Generate 4 versions of the message for a segment: "${segmentDescription}".
1. WhatsApp: Engaging, emoji-friendly, concise.
2. Email: Detailed, professional, clear CTA.
3. SMS: Short (max 160 chars), urgent.
4. RCS: Rich, interactive feel, concise.

Use {{name}} for personalization.
Return ONLY a JSON object:
{
  "whatsapp": "...",
  "email": "...",
  "sms": "...",
  "rcs": "..."
}`;
  const res = await complete([{ role: 'system', content: sys }, { role: 'user', content: intent }], { temperature: 0.8 });
  try {
    return JSON.parse(res.replace(/```json|```/g, '').trim());
  } catch (err) {
    // Fallback if JSON fails
    return { whatsapp: res, email: res, sms: res, rcs: res };
  }
}

export async function generateCampaignInsights(data) {
  const sys = `Marketing analyst. Analyze stats: ${JSON.stringify(data)}. Concise bullet points.`;
  return (await complete([{ role: 'system', content: sys }], { temperature: 0.4 })).trim();
}

export async function chatWithAssistant(messages, context) {
  const sys = `You are Xeno AI, the intelligent CRM command console.
CRM Stats: ${context.totalCustomers} customers, ${context.totalCampaigns} campaigns.
Active Segments: ${context.segments || 'None'}
Recent Campaigns: ${context.campaigns || 'None'}

When asked to perform actions, append a JSON code block.

SCHEMA DEFINITIONS:
- CREATE_SEGMENT: { 
    name: string, 
    description: string, 
    rules: { 
      operator: 'AND' | 'OR', 
      conditions: [{ field: 'totalSpend'|'orderCount'|'city'|'tags', op: 'gte'|'lte'|'eq'|'contains', value: any }] 
    } 
  }
- DELETE_SEGMENT: { segmentId: string }
- CREATE_CAMPAIGN: { name: string, segmentId: string, channel: 'whatsapp'|'sms'|'email', messageTemplate: string }
- DELETE_CAMPAIGN: { campaignId: string }

EXAMPLE COMMAND:
\`\`\`json
{ "command": "CREATE_SEGMENT", "payload": { "name": "VIPS", "rules": { "operator": "AND", "conditions": [{"field": "totalSpend", "op": "gte", "value": 5000}] } } }
\`\`\`

Always use the IDs provided in the context above for deletions or campaign targeting. Be extremely concise in your verbal response.
IMPORTANT: Only output a JSON command block when a new action is explicitly requested. NEVER repeat or re-output a previous command block in subsequent messages. Once a command is issued, it is considered executed.`;

  return await streamComplete([{ role: 'system', content: sys }, ...messages], { temperature: 0.6 });
}

export async function suggestChannel(segDesc, goal) {
  const sys = `Suggest best channel (whatsapp/sms/email/rcs). Return ONLY JSON: { "channel": "...", "reason": "..." }`;
  try {
    const res = await complete([{ role: 'system', content: sys }, { role: 'user', content: `Seg: ${segDesc}, Goal: ${goal}` }], { temperature: 0.1 });
    return JSON.parse(res.replace(/```json|```/g, '').trim());
  } catch { return { channel: 'whatsapp', reason: 'Default' }; }
}
