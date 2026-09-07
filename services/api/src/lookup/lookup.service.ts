import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GraphRepository } from '../graph/graph.repository';
import { LookupResult } from '../graph/graph.types';
import { OpenFoodFactsService } from './open-food-facts.service';
import { OcrService } from './ocr.service';
import { WhisperService } from './whisper.service';

export type LookupInputType = 'BARCODE' | 'TEXT' | 'IMAGE' | 'VOICE';

export interface LookupInput {
  type: LookupInputType;
  gtin?: string;
  query?: string;
  transcript?: string;
  image?: Buffer;
  audio?: Buffer;
  audioMimeType?: string;
  audioFilename?: string;
}

@Injectable()
export class LookupService {
  constructor(
    private readonly graphRepo: GraphRepository,
    private readonly offService: OpenFoodFactsService,
    private readonly ocrService: OcrService,
    private readonly whisperService: WhisperService,
  ) {}

  async resolve(input: LookupInput): Promise<LookupResult> {
    switch (input.type) {
      case 'BARCODE':
        return this.resolveBarcode(input.gtin!);
      case 'TEXT':
        return this.resolveText(input.query!);
      case 'IMAGE':
        return this.resolveImage(input.image!);
      case 'VOICE':
        return this.resolveVoice(
          input.transcript,
          input.audio,
          input.audioMimeType,
          input.audioFilename,
        );
      default:
        throw new BadRequestException(`Unknown lookup type: ${input.type}`);
    }
  }

  private async resolveBarcode(gtin: string): Promise<LookupResult> {
    if (!gtin?.trim()) {
      throw new BadRequestException('gtin is required for BARCODE lookup');
    }

    const normalized = gtin.trim();
    let result = await this.graphRepo.resolveFromProduct(normalized);

    if (!result) {
      const offProduct = await this.offService.fetchByGtin(normalized);
      if (!offProduct) {
        throw new NotFoundException(`No product found for GTIN ${normalized}`);
      }
      await this.graphRepo.createProduct(offProduct);
      result = await this.graphRepo.resolveFromProduct(normalized);
    }

    if (!result) {
      throw new NotFoundException(`Product ${normalized} could not be resolved`);
    }

    return result;
  }

  private async resolveText(query: string): Promise<LookupResult> {
    if (!query?.trim()) {
      throw new BadRequestException('query is required for TEXT lookup');
    }

    const hits = await this.graphRepo.fuzzySearch(query.trim(), 1);
    if (!hits.length) {
      throw new NotFoundException(`No matches for "${query}"`);
    }

    const top = hits[0];
    if (top.kind === 'product' && top.gtin) {
      return this.resolveBarcode(top.gtin);
    }

    const entity = await this.graphRepo.findEntityById(top.id);
    if (!entity) {
      throw new NotFoundException(`Entity ${top.id} not found`);
    }

    return this.graphRepo.resolveFromEntity(entity);
  }

  private async resolveImage(image: Buffer): Promise<LookupResult> {
    if (!image?.length) {
      throw new BadRequestException('image is required for IMAGE lookup');
    }

    const scene = await this.ocrService.identifyScene(image);
    const interpretation = scene.caption.trim() || 'something in your photo';
    const candidates = this.dedupeCandidates(scene.candidates);

    if (!candidates.length) {
      throw new NotFoundException(
        `It looks like ${interpretation}, but we could not identify a brand or company to look up.`,
      );
    }

    const results: LookupResult[] = [];
    const seenIds = new Set<string>();

    for (const candidate of candidates) {
      try {
        const hit = await this.resolveText(candidate);
        const key = hit.entity_id ?? hit.matched_item.toLowerCase();
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        results.push(hit);
      } catch {
        // Candidate did not match the graph — try next
      }
      if (results.length >= 5) break;
    }

    if (!results.length) {
      throw new NotFoundException(
        `It looks like ${interpretation}, but we couldn't match anything in our directory yet.`,
      );
    }

    const primary = results[0];
    return {
      ...primary,
      interpretation,
      results,
    };
  }

  private dedupeCandidates(candidates: string[]): string[] {
    const out: string[] = [];
    for (const raw of candidates) {
      const c = raw.trim();
      if (!c) continue;
      if (out.some((x) => x.toLowerCase() === c.toLowerCase())) continue;
      out.push(c);
    }
    return out.slice(0, 5);
  }

  private async resolveVoice(
    transcript?: string,
    audio?: Buffer,
    audioMimeType?: string,
    audioFilename?: string,
  ): Promise<LookupResult> {
    let text = transcript?.trim() ?? '';

    if (!text && audio?.length) {
      text = await this.whisperService.transcribe(
        audio,
        audioMimeType,
        audioFilename,
      );
    }

    if (!text) {
      throw new BadRequestException(
        audio?.length
          ? 'Could not get a transcript from the audio file'
          : 'VOICE lookup needs a transcript field or an audio file (multipart field `file`)',
      );
    }

    return this.resolveText(text);
  }

  async fuzzySearchHits(query: string, limit = 20) {
    return this.graphRepo.fuzzySearch(query, limit);
  }
}
