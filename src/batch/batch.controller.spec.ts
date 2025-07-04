import { Test, TestingModule } from '@nestjs/testing';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { PrismaService } from '../common/prisma.service';

describe('BatchController', () => {
  let controller: BatchController;
  let batchService: BatchService;

  const mockBatchService = {
    processVideosBatch: jest.fn(),
    processEmailNotificationsBatch: jest.fn(),
    processDataCleanupBatch: jest.fn(),
    getJobStatus: jest.fn(),
    getAllJobs: jest.fn(),
    getRunningJobs: jest.fn(),
  };

  const mockPrismaService = {
    video: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        {
          provide: BatchService,
          useValue: mockBatchService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<BatchController>(BatchController);
    batchService = module.get<BatchService>(BatchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startBatch', () => {
    it('should start video processing batch', async () => {
      const mockJob = {
        id: 'video-processing-123',
        type: 'VIDEO_PROCESSING' as const,
        status: 'PROCESSING' as const,
        progress: 0,
        totalItems: 10,
        processedItems: 0,
        createdAt: new Date(),
        startedAt: new Date(),
      };

      mockBatchService.processVideosBatch.mockResolvedValue(mockJob);

      const result = await controller.startBatch({
        type: 'VIDEO_PROCESSING',
        chunkSize: 10,
        concurrency: 3,
      });

      expect(result).toBe(mockJob);
      expect(mockBatchService.processVideosBatch).toHaveBeenCalledWith(10, 3);
    });

    it('should start email notification batch', async () => {
      const mockJob = {
        id: 'email-notifications-123',
        type: 'EMAIL_NOTIFICATION' as const,
        status: 'PROCESSING' as const,
        progress: 0,
        totalItems: 50,
        processedItems: 0,
        createdAt: new Date(),
        startedAt: new Date(),
      };

      mockBatchService.processEmailNotificationsBatch.mockResolvedValue(mockJob);

      const result = await controller.startBatch({
        type: 'EMAIL_NOTIFICATION',
        batchSize: 50,
      });

      expect(result).toBe(mockJob);
      expect(mockBatchService.processEmailNotificationsBatch).toHaveBeenCalledWith(50);
    });

    it('should start data cleanup batch', async () => {
      const mockJob = {
        id: 'data-cleanup-123',
        type: 'DATA_CLEANUP' as const,
        status: 'PROCESSING' as const,
        progress: 0,
        totalItems: 100,
        processedItems: 0,
        createdAt: new Date(),
        startedAt: new Date(),
      };

      mockBatchService.processDataCleanupBatch.mockResolvedValue(mockJob);

      const result = await controller.startBatch({
        type: 'DATA_CLEANUP',
      });

      expect(result).toBe(mockJob);
      expect(mockBatchService.processDataCleanupBatch).toHaveBeenCalled();
    });
  });

  describe('getBatchStatus', () => {
    it('should return batch job status', async () => {
      const mockJob = {
        id: 'test-job-123',
        type: 'VIDEO_PROCESSING' as const,
        status: 'COMPLETED' as const,
        progress: 100,
        totalItems: 10,
        processedItems: 10,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      };

      mockBatchService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getBatchStatus('test-job-123');

      expect(result).toBe(mockJob);
      expect(mockBatchService.getJobStatus).toHaveBeenCalledWith('test-job-123');
    });

    it('should throw error if job not found', async () => {
      mockBatchService.getJobStatus.mockResolvedValue(null);

      await expect(controller.getBatchStatus('non-existent')).rejects.toThrow(
        'Batch job not found'
      );
    });
  });

  describe('getAllJobs', () => {
    it('should return all batch jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'VIDEO_PROCESSING' as const,
          status: 'COMPLETED' as const,
          progress: 100,
          totalItems: 10,
          processedItems: 10,
          createdAt: new Date(),
        },
        {
          id: 'job-2',
          type: 'EMAIL_NOTIFICATION' as const,
          status: 'PROCESSING' as const,
          progress: 50,
          totalItems: 20,
          processedItems: 10,
          createdAt: new Date(),
        },
      ];

      mockBatchService.getAllJobs.mockResolvedValue(mockJobs);

      const result = await controller.getAllJobs();

      expect(result).toBe(mockJobs);
      expect(mockBatchService.getAllJobs).toHaveBeenCalled();
    });

    it('should filter jobs by status', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'VIDEO_PROCESSING' as const,
          status: 'COMPLETED' as const,
          progress: 100,
          totalItems: 10,
          processedItems: 10,
          createdAt: new Date(),
        },
      ];

      mockBatchService.getAllJobs.mockResolvedValue(mockJobs);

      const result = await controller.getAllJobs('COMPLETED');

      expect(result).toEqual(mockJobs);
    });
  });

  describe('getRunningJobs', () => {
    it('should return running batch jobs', async () => {
      const mockRunningJobs = [
        {
          id: 'running-job-1',
          type: 'VIDEO_PROCESSING' as const,
          status: 'PROCESSING' as const,
          progress: 30,
          totalItems: 100,
          processedItems: 30,
          createdAt: new Date(),
          startedAt: new Date(),
        },
      ];

      mockBatchService.getRunningJobs.mockResolvedValue(mockRunningJobs);

      const result = await controller.getRunningJobs();

      expect(result).toBe(mockRunningJobs);
      expect(mockBatchService.getRunningJobs).toHaveBeenCalled();
    });
  });
}); 