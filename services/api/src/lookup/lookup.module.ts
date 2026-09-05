import { Module } from '@nestjs/common';
import { GraphModule } from '../graph/graph.module';
import { LookupController } from './lookup.controller';
import { LookupIpThrottleGuard } from './lookup-ip-throttle.guard';
import { LookupService } from './lookup.service';
import { OcrService } from './ocr.service';
import { OpenFoodFactsService } from './open-food-facts.service';
import { WhisperService } from './whisper.service';

@Module({
  imports: [GraphModule],
  controllers: [LookupController],
  providers: [
    LookupService,
    LookupIpThrottleGuard,
    OpenFoodFactsService,
    OcrService,
    WhisperService,
  ],
  exports: [LookupService],
})
export class LookupModule {}
