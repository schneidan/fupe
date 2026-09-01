import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set; cannot transcribe audio');
      return '';
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
      'audio.webm',
    );
    form.append('model', this.config.get('WHISPER_MODEL') ?? 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      this.logger.warn(`Whisper API failed: ${res.status}`);
      return '';
    }

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? '';
  }
}
