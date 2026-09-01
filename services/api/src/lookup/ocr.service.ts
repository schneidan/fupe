import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker } from 'tesseract.js';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly config: ConfigService) {}

  async extractText(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(imageBuffer);
      const text = data.text?.trim() ?? '';
      if (text) return text;
    } finally {
      await worker.terminate();
    }

    return this.extractViaVision(imageBuffer);
  }

  private async extractViaVision(imageBuffer: Buffer): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OCR returned no text and OPENAI_API_KEY is not set');
      return '';
    }

    const base64 = imageBuffer.toString('base64');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.get('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract brand and product names from this packaging image. Return only the most likely brand/product name as plain text.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!res.ok) {
      this.logger.warn(`Vision API failed: ${res.status}`);
      return '';
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}
