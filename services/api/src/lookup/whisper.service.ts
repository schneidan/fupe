import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Formats OpenRouter `/audio/transcriptions` accepts. */
const OPENROUTER_AUDIO_FORMATS = new Set([
  'wav',
  'mp3',
  'flac',
  'm4a',
  'ogg',
  'webm',
  'aac',
]);

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(
    audioBuffer: Buffer,
    mimeType = 'audio/webm',
    filename?: string,
  ): Promise<string> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        'OPENROUTER_API_KEY is not set; cannot transcribe audio',
      );
    }

    if (!audioBuffer?.length) {
      throw new BadRequestException('audio file is empty');
    }

    const baseUrl =
      this.config.get<string>('OPENROUTER_BASE_URL')?.trim() ||
      'https://openrouter.ai/api/v1';
    const configured =
      this.config.get<string>('STT_MODEL')?.trim() ||
      this.config.get<string>('WHISPER_MODEL')?.trim() ||
      'openai/whisper-large-v3-turbo';
    const model =
      configured === 'whisper-1' ? 'openai/whisper-1' : configured;
    const format = this.resolveAudioFormat(audioBuffer, mimeType, filename);
    const url = `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    const referer = this.config.get<string>('OPENROUTER_HTTP_REFERER')?.trim();
    const title = this.config.get<string>('OPENROUTER_APP_TITLE')?.trim();
    if (referer) headers['HTTP-Referer'] = referer;
    // Chat docs use X-Title; STT docs show X-OpenRouter-Title — send both.
    if (title) {
      headers['X-Title'] = title;
      headers['X-OpenRouter-Title'] = title;
    }

    const body = {
      model,
      input_audio: {
        data: audioBuffer.toString('base64'),
        format,
      },
      // Enforce ZDR on every request (in addition to account-level ZDR).
      provider: { zdr: true },
    };

    this.logger.log(
      `OpenRouter STT → ${model} (${format}, ${audioBuffer.length} bytes, zdr=true)`,
    );

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const raw = await res.text().catch(() => '');
    if (!res.ok) {
      this.logger.warn(`OpenRouter STT failed (${model}): ${res.status} ${raw.slice(0, 500)}`);
      const detail = this.extractOrError(raw);
      throw new BadRequestException(
        `Speech transcription failed (${res.status})${detail ? `: ${detail}` : ''}. ` +
          `Model=${model}. If this is a ZDR routing miss, try another STT_MODEL with a ZDR endpoint (e.g. openai/whisper-large-v3-turbo).`,
      );
    }

    let data: { text?: string };
    try {
      data = JSON.parse(raw) as { text?: string };
    } catch {
      throw new BadRequestException(
        `Speech transcription returned non-JSON from OpenRouter: ${raw.slice(0, 200)}`,
      );
    }

    const text = data.text?.trim() ?? '';
    if (!text) {
      throw new BadRequestException(
        'Speech transcription returned empty text. Try a clearer / longer clip.',
      );
    }
    return text;
  }

  private extractOrError(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof parsed.error === 'string') return parsed.error;
      if (parsed.error?.message) return parsed.error.message;
      if (parsed.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return raw.replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  /**
   * Prefer magic bytes, then MIME, then filename extension.
   * Avoids labeling real mp3/m4a as webm when clients send a bad/missing Content-Type.
   */
  private resolveAudioFormat(
    buffer: Buffer,
    mimeType?: string,
    filename?: string,
  ): string {
    const sniffed = this.formatFromMagic(buffer);
    if (sniffed) return sniffed;

    const fromMime = this.formatFromMime(mimeType);
    if (fromMime) return fromMime;

    const fromName = this.formatFromFilename(filename);
    if (fromName) return fromName;

    throw new BadRequestException(
      'Unsupported or unrecognized audio format. Use wav, mp3, m4a, ogg, webm, flac, or aac (≤5MB).',
    );
  }

  private formatFromMagic(buf: Buffer): string | null {
    if (buf.length < 12) return null;

    // WAV: RIFF....WAVE
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x41 &&
      buf[10] === 0x56 &&
      buf[11] === 0x45
    ) {
      return 'wav';
    }

    // FLAC
    if (
      buf[0] === 0x66 &&
      buf[1] === 0x4c &&
      buf[2] === 0x61 &&
      buf[3] === 0x43
    ) {
      return 'flac';
    }

    // Ogg (Vorbis/Opus)
    if (
      buf[0] === 0x4f &&
      buf[1] === 0x67 &&
      buf[2] === 0x67 &&
      buf[3] === 0x53
    ) {
      return 'ogg';
    }

    // WebM / Matroska EBML
    if (
      buf[0] === 0x1a &&
      buf[1] === 0x45 &&
      buf[2] === 0xdf &&
      buf[3] === 0xa3
    ) {
      return 'webm';
    }

    // MP3: ID3 tag or MPEG frame sync
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
      return 'mp3';
    }
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
      // Distinguish ADTS AAC (layer bits 00) from MP3 (layer 01/10/11).
      const layer = (buf[1] >> 1) & 0x3;
      if (layer === 0) return 'aac';
      return 'mp3';
    }

    // MP4 / M4A: ....ftyp....
    if (
      buf[4] === 0x66 &&
      buf[5] === 0x74 &&
      buf[6] === 0x79 &&
      buf[7] === 0x70
    ) {
      return 'm4a';
    }

    return null;
  }

  private formatFromMime(mimeType?: string): string | null {
    if (!mimeType?.trim()) return null;
    const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!base || base === 'application/octet-stream') return null;

    const map: Record<string, string> = {
      'audio/webm': 'webm',
      'video/webm': 'webm',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/x-pn-wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'm4a',
      'audio/m4a': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
      'application/ogg': 'ogg',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
    };
    if (map[base]) return map[base];
    if (base.includes('wav')) return 'wav';
    if (base.includes('mpeg') || base.includes('mp3')) return 'mp3';
    if (base.includes('mp4') || base.includes('m4a')) return 'm4a';
    if (base.includes('webm')) return 'webm';
    if (base.includes('ogg')) return 'ogg';
    if (base.includes('flac')) return 'flac';
    if (base.includes('aac')) return 'aac';
    return null;
  }

  private formatFromFilename(filename?: string): string | null {
    if (!filename?.trim()) return null;
    const ext = filename.split('.').pop()?.trim().toLowerCase();
    if (!ext) return null;
    const map: Record<string, string> = {
      wav: 'wav',
      wave: 'wav',
      mp3: 'mp3',
      mpeg: 'mp3',
      mpga: 'mp3',
      m4a: 'm4a',
      mp4: 'm4a',
      aac: 'aac',
      ogg: 'ogg',
      oga: 'ogg',
      opus: 'ogg',
      flac: 'flac',
      webm: 'webm',
    };
    const format = map[ext];
    if (format && OPENROUTER_AUDIO_FORMATS.has(format)) return format;
    return null;
  }
}
