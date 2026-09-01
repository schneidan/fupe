import { Module } from '@nestjs/common';
import { GraphModule } from '../graph/graph.module';
import { LookupController } from './lookup.controller';
import { LookupService } from './lookup.service';
import { OcrService } from './ocr.service';
import { OpenFoodFactsService } from './open-food-facts.service';
import { WhisperService } from './whisper.service';

@Module({
  imports: [GraphModule],
  controllers: [LookupController],
  providers: [
    LookupService,
    OpenFoodFactsService,
    OcrService,
    WhisperService,
  ],
  exports: [LookupService],
})
export class LookupModule {}
