import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GraphRepository } from '../graph/graph.repository';
import { FuzzySearchHit, LookupResult } from '../graph/graph.types';
import { normalizeNameKey, toSlug } from '../common/slug';
import { OpenFoodFactsService } from './open-food-facts.service';
import { OcrService } from './ocr.service';
import { WhisperService } from './whisper.service';

/** Auto-navigate / TEXT resolve only when the top hit clears this bar. */
const AUTO_MATCH_SCORE = 0.42;
/** Top hit must beat #2 by this much unless it's an exact/normalized name match. */
const AUTO_MATCH_GAP = 0.1;

export type LookupInputType = 'BARCODE' | 'TEXT' | 'IMAGE' | 'VOICE';

export interface LookupInput {
  type: LookupInputType;
  gtin?: string;
  query?: string;
  transcript?: string;
  image?: Buffer;
  /** IMAGE: when false, Tesseract OCR only (no third-party vision). Default true. */
  useAi?: boolean;
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
        return this.resolveImage(input.image!, input.useAi !== false);
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

    const hits = await this.graphRepo.fuzzySearch(query.trim(), 8);
    if (!hits.length) {
      throw new NotFoundException(`No matches for "${query}"`);
    }

    if (!this.isConfidentMatch(query.trim(), hits)) {
      throw new NotFoundException(
        `No clear match for "${query}". Try a more specific name, browse the directory, or suggest an addition.`,
      );
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

  /**
   * Exact / near-exact names always win. Typos need a strong trgm score and a
   * clear gap over the runner-up so "starbucks" never resolves to "Arby's".
   * Short queries must not auto-match mid-string (e.g. "utz" → "Schutzstaffel").
   */
  private isConfidentMatch(query: string, hits: FuzzySearchHit[]): boolean {
    const top = hits[0];
    if (!top) return false;

    const q = query.trim();
    const qLower = q.toLowerCase();
    const topLower = top.name.trim().toLowerCase();
    const qKey = normalizeNameKey(query);
    const topKey = normalizeNameKey(top.name);

    if (qKey && topKey && qKey === topKey) return true;
    if (qLower === topLower) return true;
    if (top.slug && top.slug === toSlug(query)) return true;

    const topWords = topLower.split(/[^a-z0-9]+/).filter(Boolean);
    const queryIsWholeWord = topWords.includes(qLower);
    const startsWithQuery =
      topLower.startsWith(qLower) ||
      topWords.some((w) => w.startsWith(qLower) && qLower.length >= 3);

    // Short tokens: only exact/whole-word or strong prefix — never mid-string.
    if (q.length <= 4) {
      return (
        queryIsWholeWord ||
        (startsWithQuery && top.score >= 0.85)
      );
    }

    if (top.score < AUTO_MATCH_SCORE) return false;

    // Bare "contains" (~0.55 from SQL) is too weak to auto-resolve alone.
    const onlyLooseContains =
      !startsWithQuery &&
      !queryIsWholeWord &&
      topLower.includes(qLower) &&
      top.score < 0.85;
    if (onlyLooseContains) return false;

    const second = hits[1];
    if (!second) {
      // Solo hit still needs a solid score (or a clear prefix).
      return top.score >= 0.55 || startsWithQuery;
    }
    if (top.score - second.score >= AUTO_MATCH_GAP) return true;

    return top.score >= 0.72 && top.score - second.score >= 0.05;
  }

  private async resolveImage(
    image: Buffer,
    useAi = true,
  ): Promise<LookupResult> {
    if (!image?.length) {
      throw new BadRequestException('image is required for IMAGE lookup');
    }

    const scene = await this.ocrService.identifyScene(image, { useAi });
    const interpretation = scene.caption.trim() || 'something in your photo';
    const candidates = this.dedupeCandidates(scene.candidates);

    if (!candidates.length) {
      throw new NotFoundException(
        `It looks like ${interpretation}, but we could not identify a brand or company to look up.`,
      );
    }

    const results: LookupResult[] = [];
    const unmatchedGuesses: string[] = [];
    const seenIds = new Set<string>();

    for (const candidate of candidates) {
      try {
        const hit = await this.resolveText(candidate);
        const key = hit.entity_id ?? hit.matched_item.toLowerCase();
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        results.push(hit);
      } catch {
        unmatchedGuesses.push(candidate);
      }
      if (results.length >= 5) break;
    }

    // Always return a structured IMAGE payload so the client can show a picker
    // (including "we saw these names but they're not in FUPE yet").
    if (!results.length) {
      return {
        matched_item: unmatchedGuesses[0] ?? interpretation,
        is_private_equity_owned: false,
        ultimate_parent: null,
        ownership_chain: [],
        citations: [],
        interpretation,
        results: [],
        unmatched_guesses: unmatchedGuesses,
      };
    }

    const primary = results[0];
    return {
      ...primary,
      interpretation,
      results,
      unmatched_guesses: unmatchedGuesses,
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
    return out.slice(0, 8);
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
