import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(
    audioBuffer: Buffer,
    mimeType = 'audio/webm',
  ): Promise<string> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set; cannot transcribe audio');
      return '';
    }

    const baseUrl =
      this.config.get<string>('OPENROUTER_BASE_URL')?.trim() ||
      'https://openrouter.ai/api/v1';
    const model =
      this.config.get<string>('STT_MODEL')?.trim() ||
      'mistralai/voxtral-mini-transcribe';
    const format = this.formatFromMime(mimeType);
    const base64Audio = audioBuffer.toString('base64');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    const referer = this.config.get<string>('OPENROUTER_HTTP_REFERER')?.trim();
    const title = this.config.get<string>('OPENROUTER_APP_TITLE')?.trim();
    if (referer) headers['HTTP-Referer'] = referer;
    if (title) headers['X-Title'] = title;

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        input_audio: {
          data: base64Audio,
          format,
        },
        language: 'en',
        // Enforce ZDR on every request (in addition to account-level ZDR).
        provider: { zdr: true },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      this.logger.warn(
        `OpenRouter STT failed (${model}): ${res.status} ${errBody.slice(0, 200)}`,
      );
      return '';
    }

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? '';
  }

  private formatFromMime(mimeType: string): string {
    const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    const map: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'm4a',
      'audio/m4a': 'm4a',
      'audio/ogg': 'ogg',
      'audio/flac': 'flac',
      'audio/aac': 'aac',
    };
    return map[base] ?? 'webm';
  }
}
