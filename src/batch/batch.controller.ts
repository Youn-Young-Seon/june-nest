import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  HttpException, 
  HttpStatus,
  Query
} from '@nestjs/common';
import { BatchService, BatchJob } from './batch.service';

export interface StartBatchRequest {
  type: 'VIDEO_PROCESSING' | 'EMAIL_NOTIFICATION' | 'DATA_CLEANUP';
  chunkSize?: number;
  concurrency?: number;
  batchSize?: number;
}

@Controller('batch')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  // 🚀 배치 작업 시작
  @Post('start')
  async startBatch(@Body() request: StartBatchRequest): Promise<BatchJob> {
    try {
      switch (request.type) {
        case 'VIDEO_PROCESSING':
          return await this.batchService.processVideosBatch(
            request.chunkSize || 10,
            request.concurrency || 3
          );
        
        case 'EMAIL_NOTIFICATION':
          return await this.batchService.processEmailNotificationsBatch(
            request.batchSize || 50
          );
        
        case 'DATA_CLEANUP':
          return await this.batchService.processDataCleanupBatch();
        
        default:
          throw new HttpException(
            'Invalid batch type',
            HttpStatus.BAD_REQUEST
          );
      }
    } catch (error) {
      throw new HttpException(
        `Failed to start batch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 📊 배치 작업 상태 조회
  @Get('status/:jobId')
  async getBatchStatus(@Param('jobId') jobId: string): Promise<BatchJob> {
    const job = await this.batchService.getJobStatus(jobId);
    
    if (!job) {
      throw new HttpException(
        'Batch job not found',
        HttpStatus.NOT_FOUND
      );
    }
    
    return job;
  }

  // 📋 모든 배치 작업 조회
  @Get('jobs')
  async getAllJobs(
    @Query('status') status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  ): Promise<BatchJob[]> {
    const allJobs = await this.batchService.getAllJobs();
    
    if (status) {
      return allJobs.filter(job => job.status === status);
    }
    
    return allJobs;
  }

  // ⚡ 실행 중인 배치 작업 조회
  @Get('running')
  async getRunningJobs(): Promise<BatchJob[]> {
    return await this.batchService.getRunningJobs();
  }

  // 🎬 비디오 처리 배치 시작 (간편 API)
  @Post('video-processing')
  async startVideoProcessing(
    @Body() options: { chunkSize?: number; concurrency?: number } = {}
  ): Promise<BatchJob> {
    try {
      return await this.batchService.processVideosBatch(
        options.chunkSize || 10,
        options.concurrency || 3
      );
    } catch (error) {
      throw new HttpException(
        `Failed to start video processing batch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 📧 이메일 알림 배치 시작 (간편 API)
  @Post('email-notifications')
  async startEmailNotifications(
    @Body() options: { batchSize?: number } = {}
  ): Promise<BatchJob> {
    try {
      return await this.batchService.processEmailNotificationsBatch(
        options.batchSize || 50
      );
    } catch (error) {
      throw new HttpException(
        `Failed to start email notifications batch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 🧹 데이터 정리 배치 시작 (간편 API)
  @Post('data-cleanup')
  async startDataCleanup(): Promise<BatchJob> {
    try {
      return await this.batchService.processDataCleanupBatch();
    } catch (error) {
      throw new HttpException(
        `Failed to start data cleanup batch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 