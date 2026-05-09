import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { visionResultSchema, type VisionResult } from '@print-suggester/shared';
import { config, visionProvider } from '../config.js';
import { logger } from '../logger.js';

const SYSTEM_PROMPT = `You are an expert in 3D printing and accessories. Given a photo of an object, identify the primary object and suggest 3-5 useful 3D-printable accessory categories.

Rules:
1. Be specific. "Phone case" is too generic. "MagSafe iPhone 15 stand with adjustable angle" is good.
2. Focus on accessories that *enhance* the object - mounts, holders, organizers, replacement parts, attachments.
3. Each category needs 1-3 search_terms that would surface relevant prints on Printables/MakerWorld.
4. Confidence reflects how likely the user would actually want this. Reserve <0.5 for tangential ideas.
5. Output valid JSON only. No markdown fences, no commentary.

Output schema:
{
  "object": string,
  "attributes": string[],
  "accessory_categories": [
    { "label": string, "search_terms": string[], "confidence": number, "reasoning": string }
  ]
}`;

const FEW_SHOT = `Examples:

Input: standing desk with two monitors and visible tangled cables
Output: {"object":"standing desk","attributes":["dual monitors","exposed cabling","metal frame"],"accessory_categories":[{"label":"Under-desk cable management tray","search_terms":["under desk cable tray","cable management clip"],"confidence":0.95,"reasoning":"visible tangled cables"},{"label":"Headphone hook (clamp-on)","search_terms":["under desk headphone hook","headphone hanger clamp"],"confidence":0.8,"reasoning":"common desk accessory"},{"label":"Monitor riser","search_terms":["monitor stand riser"],"confidence":0.6,"reasoning":"adjusts monitor height"}]}

Input: GoPro action camera
Output: {"object":"GoPro action camera","attributes":["compact","mounting tabs"],"accessory_categories":[{"label":"GoPro helmet mount","search_terms":["gopro helmet mount","action cam helmet adapter"],"confidence":0.9,"reasoning":"common use case"},{"label":"GoPro tripod adapter","search_terms":["gopro tripod adapter","gopro 1/4 inch mount"],"confidence":0.85,"reasoning":"connects to standard tripods"},{"label":"Lens cap / cover","search_terms":["gopro lens cap","gopro cover"],"confidence":0.6,"reasoning":"protects lens"}]}`;

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export async function analyzeImage(
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<VisionResult> {
  if (visionProvider === 'mock') {
    logger.warn('vision.mock', { reason: 'no GOOGLE_API_KEY or ANTHROPIC_API_KEY set' });
    return mockVisionResult();
  }
  if (visionProvider === 'gemini') return analyzeWithGemini(image, mediaType);
  return analyzeWithAnthropic(image, mediaType);
}

let geminiClient: GoogleGenerativeAI | null = null;
async function analyzeWithGemini(
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<VisionResult> {
  if (!geminiClient) {
    if (!config.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY missing');
    geminiClient = new GoogleGenerativeAI(config.GOOGLE_API_KEY);
  }
  const model = geminiClient.getGenerativeModel({
    model: config.GEMINI_MODEL,
    systemInstruction: `${SYSTEM_PROMPT}\n\n${FEW_SHOT}`,
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1024 },
  });

  const result = await model.generateContent([
    { inlineData: { data: image.toString('base64'), mimeType: mediaType } },
    { text: 'Analyze this object and suggest 3D-printable accessories. JSON only.' },
  ]);
  const text = result.response.text();
  const json = extractJson(text);
  return visionResultSchema.parse(json);
}

let anthropic: Anthropic | null = null;
async function analyzeWithAnthropic(
  image: Buffer,
  mediaType: SupportedMediaType,
): Promise<VisionResult> {
  if (!anthropic) {
    if (!config.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
    anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  const message = await anthropic.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `${SYSTEM_PROMPT}\n\n${FEW_SHOT}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: image.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Analyze this object and suggest 3D-printable accessories. JSON only.',
          },
        ],
      },
    ],
  });
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const json = extractJson(text);
  return visionResultSchema.parse(json);
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in vision response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

function mockVisionResult(): VisionResult {
  return {
    object: 'unknown object (mock)',
    attributes: ['mocked - set GOOGLE_API_KEY for real analysis'],
    accessory_categories: [
      { label: 'Generic stand', search_terms: ['phone stand', 'desk stand'], confidence: 0.5 },
      { label: 'Cable organizer', search_terms: ['cable organizer'], confidence: 0.4 },
      { label: 'Wall mount', search_terms: ['wall mount bracket'], confidence: 0.3 },
    ],
  };
}
