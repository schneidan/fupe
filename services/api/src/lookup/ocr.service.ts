import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker } from 'tesseract.js';

export interface SceneIdentifyResult {
  caption: string;
  candidates: string[];
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Identify brands/companies in a photo (packaging, logo, storefront, signage).
   * Prefers OpenRouter vision when configured; falls back to Tesseract OCR.
   */
  async identifyScene(
    imageBuffer: Buffer,
    options: { useAi?: boolean } = {},
  ): Promise<SceneIdentifyResult> {
    const useAi = options.useAi !== false;
    if (useAi && this.openRouterApiKey()) {
      const vision = await this.identifyViaVision(imageBuffer);
      if (vision.candidates.length || vision.caption) {
        return vision;
      }
    }

    const text = await this.extractViaTesseract(imageBuffer);
    if (!text) {
      return { caption: '', candidates: [] };
    }

    const candidates = this.candidatesFromOcrText(text);
    return {
      caption: candidates[0]
        ? `text that looks like “${candidates[0]}”`
        : 'text on the image',
      candidates,
    };
  }

  /** @deprecated Prefer identifyScene — kept for any direct OCR callers. */
  async extractText(imageBuffer: Buffer): Promise<string> {
    const scene = await this.identifyScene(imageBuffer);
    return scene.candidates[0] ?? scene.caption ?? '';
  }

  private openRouterApiKey(): string | undefined {
    return this.config.get<string>('OPENROUTER_API_KEY')?.trim() || undefined;
  }

  private openRouterBaseUrl(): string {
    return (
      this.config.get<string>('OPENROUTER_BASE_URL')?.trim() ||
      'https://openrouter.ai/api/v1'
    );
  }

  private visionModel(): string {
    return (
      this.config.get<string>('VISION_MODEL')?.trim() ||
      'google/gemini-2.5-flash-lite'
    );
  }

  private openRouterHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    const referer = this.config.get<string>('OPENROUTER_HTTP_REFERER')?.trim();
    const title = this.config.get<string>('OPENROUTER_APP_TITLE')?.trim();
    if (referer) headers['HTTP-Referer'] = referer;
    if (title) headers['X-Title'] = title;
    return headers;
  }

  private async extractViaTesseract(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(imageBuffer);
      return data.text?.trim() ?? '';
    } finally {
      await worker.terminate();
    }
  }

  private candidatesFromOcrText(text: string): string[] {
    const lines = text
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length >= 3 && /[A-Za-z]/.test(l));

    const uniq: string[] = [];
    for (const line of lines.slice(0, 12)) {
      const cleaned = line.replace(/[^A-Za-z0-9 '&.,\-]/g, '').trim();
      if (cleaned.length < 3) continue;
      if (uniq.some((u) => u.toLowerCase() === cleaned.toLowerCase())) continue;
      uniq.push(cleaned);
      if (uniq.length >= 5) break;
    }

    if (!uniq.length) {
      const collapsed = text.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (collapsed) uniq.push(collapsed);
    }
    return uniq;
  }

  private async identifyViaVision(
    imageBuffer: Buffer,
  ): Promise<SceneIdentifyResult> {
    const apiKey = this.openRouterApiKey();
    if (!apiKey) {
      return { caption: '', candidates: [] };
    }

    const model = this.visionModel();
    const base64 = imageBuffer.toString('base64');
    const res = await fetch(`${this.openRouterBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.openRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        // Enforce ZDR on every request (in addition to account-level ZDR).
        provider: { zdr: true },
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'You identify companies, brands, and products in photos for an ownership-lookup app.',
                  'The image may be packaging, a logo, a storefront, a gas station, a restaurant, clothing, or signage.',
                  'Return JSON only with this shape:',
                  '{"caption":"short phrase like \\"a Panera storefront\\" or \\"a Life cereal box\\"","candidates":["Brand Or Company Name",...]}',
                  'caption: what the photo appears to show (plain English, no quotes).',
                  'candidates: up to 5 distinct company/brand names likely depicted (most specific first).',
                  'If several different companies appear, include each. If unsure, still guess the most likely names.',
                  'If nothing identifiable, return {"caption":"an unclear photo","candidates":[]}.',
                ].join(' '),
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      this.logger.warn(
        `OpenRouter vision failed (${model}): ${res.status} ${errBody.slice(0, 200)}`,
      );
      return { caption: '', candidates: [] };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    return this.parseVisionJson(raw);
  }

  private parseVisionJson(raw: string): SceneIdentifyResult {
    try {
      const parsed = JSON.parse(raw) as {
        caption?: unknown;
        candidates?: unknown;
      };
      const caption =
        typeof parsed.caption === 'string' ? parsed.caption.trim() : '';
      const candidates = Array.isArray(parsed.candidates)
        ? parsed.candidates
            .filter((c): c is string => typeof c === 'string')
            .map((c) => c.trim())
            .filter(Boolean)
            .slice(0, 5)
        : [];
      return { caption, candidates };
    } catch {
      const fallback = raw.replace(/^["']|["']$/g, '').trim();
      return {
        caption: fallback ? fallback.slice(0, 120) : '',
        candidates: fallback ? [fallback.slice(0, 80)] : [],
      };
    }
  }
}
