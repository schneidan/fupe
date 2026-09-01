import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphRepository } from '../graph/graph.repository';
import { ProductProperties } from '../graph/graph.types';

interface OffProduct {
  product_name?: string;
  brands?: string;
  categories?: string;
}

@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('OPEN_FOOD_FACTS_URL') ??
      'https://world.openfoodfacts.org/api/v2/product';
  }

  async fetchByGtin(gtin: string): Promise<ProductProperties | null> {
    try {
      const res = await fetch(`${this.baseUrl}/${gtin}.json`);
      if (!res.ok) return null;

      const data = (await res.json()) as {
        status: number;
        product?: OffProduct;
      };

      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      return {
        gtin,
        name: p.product_name ?? p.brands ?? `Product ${gtin}`,
        category: p.categories?.split(',')[0]?.trim() ?? 'unknown',
      };
    } catch (err) {
      this.logger.warn(`Open Food Facts lookup failed for ${gtin}: ${err}`);
      return null;
    }
  }
}
