import { Module } from '@nestjs/common';
import { BatchService } from './batch.service';
import { BatchController } from './batch.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService]
})
export class BatchModule {} 