import { Module } from '@nestjs/common';
import { StreamingService } from './streaming.service';
import { StreamingController } from './streaming.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StreamingController],
  providers: [StreamingService],
  exports: [StreamingService]
})
export class StreamingModule {} 