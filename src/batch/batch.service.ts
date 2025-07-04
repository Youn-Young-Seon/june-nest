import { Injectable, Logger } from '@nestjs/common';
import { 
  pipe, 
  toAsync, 
  filter, 
  map, 
  chunk, 
  delay, 
  tap, 
  toArray 
} from '@fxts/core';
import { PrismaService } from '../common/prisma.service';

export interface BatchJob {
  id: string;
  type: 'VIDEO_PROCESSING' | 'EMAIL_NOTIFICATION' | 'DATA_CLEANUP';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  totalItems: number;
  processedItems: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private jobs = new Map<string, BatchJob>();

  constructor(private prisma: PrismaService) {}

  // 🚀 비디오 처리 배치 - FxTS 청크 처리와 동시성 제어
  async processVideosBatch(
    chunkSize: number = 10,
    concurrency: number = 3
  ): Promise<BatchJob> {
    const jobId = `video-processing-${Date.now()}`;
    
    this.logger.log(`🎬 Starting video processing batch: ${jobId}`);
    
    try {
      // 1. 처리할 비디오 목록 조회 (썸네일이 없는 비디오들)
      const videos = await this.prisma.video.findMany({
        where: { 
          thumbnailPath: null
        },
        take: 100, // 배치 크기 제한
        include: {
          uploadedBy: {
            select: { idx: true, email: true, name: true }
          }
        }
      });

      const job: BatchJob = {
        id: jobId,
        type: 'VIDEO_PROCESSING',
        status: 'PROCESSING',
        progress: 0,
        totalItems: videos.length,
        processedItems: 0,
        createdAt: new Date(),
        startedAt: new Date()
      };

      this.jobs.set(jobId, job);

      if (videos.length === 0) {
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.progress = 100;
        this.logger.log(`🎉 No videos to process`);
        return job;
      }

      // 2. 🔥 FxTS 배치 처리 파이프라인 - 간단한 구조
      const videoChunks = await pipe(
        videos,
        toAsync,
        chunk(chunkSize),
        toArray
      );

      // 3. 청크별 처리 with 동시성 제어
      for (const videoChunk of videoChunks) {
        this.logger.log(`📦 Processing chunk of ${videoChunk.length} videos`);
        
        // 청크 내에서 순차 처리
        for (const video of videoChunk) {
          try {
            // 비디오 처리 시뮬레이션
            await this.processVideoItem(video);
            
            // 진행 상황 업데이트
            job.processedItems++;
            job.progress = Math.round((job.processedItems / job.totalItems) * 100);
            
            this.logger.log(`✅ Processed video: ${video.title} (${job.processedItems}/${job.totalItems})`);
            
            // 처리 간 딜레이
            await delay(500);
            
          } catch (error) {
            this.logger.error(`❌ Failed to process video ${video.idx}:`, error);
          }
        }

        // 청크 간 딜레이 (시스템 부하 방지)
        await delay(1000);
      }

      // 4. 배치 작업 완료 처리
      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.progress = 100;

      this.logger.log(`🎉 Video processing batch completed: ${job.processedItems} videos processed`);

      return job;

    } catch (error) {
      this.logger.error(`💥 Video processing batch failed:`, error);
      
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'FAILED';
        job.error = error.message;
        job.completedAt = new Date();
      }
      
      throw error;
    }
  }

  // 🔥 이메일 알림 배치 - 대량 이메일 발송
  async processEmailNotificationsBatch(
    batchSize: number = 50
  ): Promise<BatchJob> {
    const jobId = `email-notifications-${Date.now()}`;
    
    this.logger.log(`📧 Starting email notifications batch: ${jobId}`);

    try {
      // 이메일 발송 대상 조회
      const users = await this.prisma.user.findMany({
        include: {
          Video: {
            where: { 
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 최근 1주일
              }
            }
          }
        }
      });

      // 🔥 FxTS를 활용한 이메일 데이터 준비
      const emailTargets = await pipe(
        users,
        toAsync,
        filter(user => user.Video.length > 0), // 최근 업로드가 있는 사용자만
        map(user => ({
          idx: user.idx,
          email: user.email,
          name: user.name || 'User',
          videoCount: user.Video.length
        })),
        toArray
      );

      const job: BatchJob = {
        id: jobId,
        type: 'EMAIL_NOTIFICATION',
        status: 'PROCESSING',
        progress: 0,
        totalItems: emailTargets.length,
        processedItems: 0,
        createdAt: new Date(),
        startedAt: new Date()
      };

      this.jobs.set(jobId, job);

      if (emailTargets.length === 0) {
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.progress = 100;
        this.logger.log(`📬 No emails to send`);
        return job;
      }

      // 🚀 FxTS 이메일 배치 처리 - 청크 단위 처리
      const emailChunks = await pipe(
        emailTargets,
        toAsync,
        chunk(batchSize),
        toArray
      );

      for (const emailChunk of emailChunks) {
        this.logger.log(`📮 Processing email chunk: ${emailChunk.length} emails`);
        
        await pipe(
          emailChunk,
          toAsync,
          map(async (user) => {
            try {
              await this.sendWeeklyEmail(user);
              
              job.processedItems++;
              job.progress = Math.round((job.processedItems / job.totalItems) * 100);
              
              this.logger.log(`📧 Sent email to ${user.email} (${job.processedItems}/${job.totalItems})`);
              
              return { success: true, userId: user.idx };
            } catch (error) {
              this.logger.error(`❌ Failed to send email to ${user.email}:`, error);
              return { success: false, userId: user.idx, error: error.message };
            }
          }),
          // 이메일 발송 간격 제어
          tap(async () => await delay(500)),
          toArray
        );

        // 청크 간 딜레이 (스팸 방지)
        await delay(2000);
      }

      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.progress = 100;

      this.logger.log(`📬 Email notifications batch completed: ${job.processedItems} emails sent`);

      return job;

    } catch (error) {
      this.logger.error(`💥 Email notifications batch failed:`, error);
      
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'FAILED';
        job.error = error.message;
        job.completedAt = new Date();
      }
      
      throw error;
    }
  }

  // 🔥 데이터 정리 배치 - 오래된 비디오 정리
  async processDataCleanupBatch(): Promise<BatchJob> {
    const jobId = `data-cleanup-${Date.now()}`;
    
    this.logger.log(`🧹 Starting data cleanup batch: ${jobId}`);

    try {
      // 30일 이상 된 비디오 조회
      const oldVideos = await this.prisma.video.findMany({
        where: {
          createdAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        take: 100 // 배치 크기 제한
      });

      const job: BatchJob = {
        id: jobId,
        type: 'DATA_CLEANUP',
        status: 'PROCESSING',
        progress: 0,
        totalItems: oldVideos.length,
        processedItems: 0,
        createdAt: new Date(),
        startedAt: new Date()
      };

      this.jobs.set(jobId, job);

      if (oldVideos.length === 0) {
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.progress = 100;
        this.logger.log(`🧹 No old videos to cleanup`);
        return job;
      }

      // 🚀 FxTS 데이터 정리 파이프라인 - 작은 청크로 안전하게 처리
      const videoChunks = await pipe(
        oldVideos,
        toAsync,
        chunk(10), // 작은 청크 (DB 부하 방지)
        toArray
      );

      for (const videoChunk of videoChunks) {
        this.logger.log(`🗑️  Processing cleanup chunk: ${videoChunk.length} videos`);
        
        await pipe(
          videoChunk,
          toAsync,
          map(async (video) => {
            try {
              // 비디오 정리 처리 (아카이빙)
              await this.cleanupVideoData(video);
              
              job.processedItems++;
              job.progress = Math.round((job.processedItems / job.totalItems) * 100);
              
              this.logger.log(`🗄️  Cleaned up video: ${video.title} (${job.processedItems}/${job.totalItems})`);
              
              return { success: true, videoId: video.idx };
            } catch (error) {
              this.logger.error(`❌ Failed to cleanup video ${video.idx}:`, error);
              return { success: false, videoId: video.idx, error: error.message };
            }
          }),
          // 처리 간 딜레이 (DB 부하 방지)
          tap(async () => await delay(200)),
          toArray
        );

        // 청크 간 딜레이
        await delay(1000);
      }

      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.progress = 100;

      this.logger.log(`🧹 Data cleanup batch completed: ${job.processedItems} videos processed`);

      return job;

    } catch (error) {
      this.logger.error(`💥 Data cleanup batch failed:`, error);
      
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'FAILED';
        job.error = error.message;
        job.completedAt = new Date();
      }
      
      throw error;
    }
  }

  // 배치 작업 상태 조회
  async getJobStatus(jobId: string): Promise<BatchJob | null> {
    return this.jobs.get(jobId) || null;
  }

  // 모든 배치 작업 조회
  async getAllJobs(): Promise<BatchJob[]> {
    return Array.from(this.jobs.values());
  }

  // 실행 중인 배치 작업 조회
  async getRunningJobs(): Promise<BatchJob[]> {
    return Array.from(this.jobs.values()).filter(job => job.status === 'PROCESSING');
  }

  // 🔧 Private 헬퍼 메서드들
  private async processVideoItem(video: any): Promise<void> {
    // 비디오 처리 로직 (썸네일 생성, 메타데이터 추출 등)
    await delay(Math.random() * 2000 + 1000); // 1-3초 처리 시뮬레이션
    
    // 실제로는 여기서 썸네일 생성이나 비디오 인코딩 등을 수행
    await this.prisma.video.update({
      where: { idx: video.idx },
      data: {
        thumbnailPath: `/thumbnails/${video.idx}.jpg`,
        updatedAt: new Date()
      }
    });
  }

  private async sendWeeklyEmail(user: any): Promise<void> {
    // 이메일 발송 로직
    await delay(Math.random() * 1000 + 500); // 0.5-1.5초 발송 시뮬레이션
    
    const subject = `Weekly Summary - ${user.videoCount} videos uploaded`;
    const message = `Hi ${user.name}, you uploaded ${user.videoCount} videos this week!`;
    
    // 실제로는 여기서 이메일 서비스 API 호출
    this.logger.log(`📧 Email sent to ${user.email}: ${subject}`);
  }

  private async cleanupVideoData(video: any): Promise<void> {
    // 비디오 데이터 정리 로직 (아카이빙)
    await delay(Math.random() * 500 + 200); // 0.2-0.7초 처리 시뮬레이션
    
    // 실제 서비스에서는 파일 백업 후 아카이빙 플래그 설정
    await this.prisma.video.update({
      where: { idx: video.idx },
      data: {
        description: `[ARCHIVED] ${video.description || ''}`,
        updatedAt: new Date()
      }
    });
  }
} 