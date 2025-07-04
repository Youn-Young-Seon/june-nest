import { Test, TestingModule } from '@nestjs/testing';
import { BatchService } from './batch.service';
import { PrismaService } from '../common/prisma.service';

describe('BatchService', () => {
  let service: BatchService;
  let prismaService: PrismaService;

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
      providers: [
        BatchService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processVideosBatch', () => {
    it('should process videos in chunks with FxTS', async () => {
      const mockVideos = [
        {
          idx: 1,
          title: 'Video 1',
          fileName: 'video1.mp4',
          size: 1000,
          mimeType: 'video/mp4',
          uploadedById: 1,
          thumbnailPath: null,
          uploadedBy: { idx: 1, email: 'user1@test.com', name: 'User 1' },
        },
        {
          idx: 2,
          title: 'Video 2',
          fileName: 'video2.mp4',
          size: 2000,
          mimeType: 'video/mp4',
          uploadedById: 2,
          thumbnailPath: null,
          uploadedBy: { idx: 2, email: 'user2@test.com', name: 'User 2' },
        },
      ];

      mockPrismaService.video.findMany.mockResolvedValue(mockVideos);
      mockPrismaService.video.update.mockResolvedValue({});

      const result = await service.processVideosBatch(2, 1);

      expect(result.type).toBe('VIDEO_PROCESSING');
      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(2);
      expect(result.processedItems).toBe(2);
      expect(result.progress).toBe(100);

      // FxTS chunk processing should have been used
      expect(mockPrismaService.video.findMany).toHaveBeenCalledWith({
        where: { thumbnailPath: null },
        take: 100,
        include: {
          uploadedBy: {
            select: { idx: true, email: true, name: true },
          },
        },
      });

      // Each video should have been updated with thumbnail
      expect(mockPrismaService.video.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.video.update).toHaveBeenCalledWith({
        where: { idx: 1 },
        data: {
          thumbnailPath: '/thumbnails/1.jpg',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle empty video list', async () => {
      mockPrismaService.video.findMany.mockResolvedValue([]);

      const result = await service.processVideosBatch(10, 3);

      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(0);
      expect(result.processedItems).toBe(0);
      expect(result.progress).toBe(100);
    });
  });

  describe('processEmailNotificationsBatch', () => {
    it('should process email notifications with FxTS filtering and mapping', async () => {
      const mockUsers = [
        {
          idx: 1,
          email: 'user1@test.com',
          name: 'User 1',
          Video: [
            { idx: 1, createdAt: new Date() },
            { idx: 2, createdAt: new Date() },
          ],
        },
        {
          idx: 2,
          email: 'user2@test.com',
          name: 'User 2',
          Video: [], // No recent videos
        },
        {
          idx: 3,
          email: 'user3@test.com',
          name: 'User 3',
          Video: [{ idx: 3, createdAt: new Date() }],
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.processEmailNotificationsBatch(10);

      expect(result.type).toBe('EMAIL_NOTIFICATION');
      expect(result.status).toBe('COMPLETED');
      // Should filter out user with no videos (User 2)
      expect(result.totalItems).toBe(2);
      expect(result.processedItems).toBe(2);
      expect(result.progress).toBe(100);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        include: {
          Video: {
            where: {
              createdAt: {
                gte: expect.any(Date),
              },
            },
          },
        },
      });
    });

    it('should handle no eligible users for email', async () => {
      const mockUsers = [
        {
          idx: 1,
          email: 'user1@test.com',
          name: 'User 1',
          Video: [], // No recent videos
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.processEmailNotificationsBatch(50);

      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(0);
      expect(result.processedItems).toBe(0);
      expect(result.progress).toBe(100);
    });
  });

  describe('processDataCleanupBatch', () => {
    it('should process old videos cleanup with FxTS chunking', async () => {
      const mockOldVideos = [
        {
          idx: 1,
          title: 'Old Video 1',
          description: 'Old description',
          createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days old
        },
        {
          idx: 2,
          title: 'Old Video 2',
          description: null,
          createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days old
        },
      ];

      mockPrismaService.video.findMany.mockResolvedValue(mockOldVideos);
      mockPrismaService.video.update.mockResolvedValue({});

      const result = await service.processDataCleanupBatch();

      expect(result.type).toBe('DATA_CLEANUP');
      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(2);
      expect(result.processedItems).toBe(2);
      expect(result.progress).toBe(100);

      // Should query for old videos
      expect(mockPrismaService.video.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
        take: 100,
      });

      // Should update videos with archived flag
      expect(mockPrismaService.video.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.video.update).toHaveBeenCalledWith({
        where: { idx: 1 },
        data: {
          description: '[ARCHIVED] Old description',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle no old videos to cleanup', async () => {
      mockPrismaService.video.findMany.mockResolvedValue([]);

      const result = await service.processDataCleanupBatch();

      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(0);
      expect(result.processedItems).toBe(0);
      expect(result.progress).toBe(100);
    });
  });

  describe('job management', () => {
    it('should track and retrieve job status', async () => {
      mockPrismaService.video.findMany.mockResolvedValue([]);

      const job = await service.processVideosBatch(10, 3);
      const retrievedJob = await service.getJobStatus(job.id);

      expect(retrievedJob).toEqual(job);
    });

    it('should return null for non-existent job', async () => {
      const result = await service.getJobStatus('non-existent-job');
      expect(result).toBeNull();
    });

    it('should return all jobs', async () => {
      mockPrismaService.video.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const job1 = await service.processVideosBatch(10, 3);
      const job2 = await service.processEmailNotificationsBatch(50);

      const allJobs = await service.getAllJobs();

      expect(allJobs).toHaveLength(2);
      expect(allJobs).toContainEqual(job1);
      expect(allJobs).toContainEqual(job2);
    });

    it('should return only running jobs', async () => {
      // This test would require mocking longer-running operations
      // For now, we'll test the basic functionality
      const runningJobs = await service.getRunningJobs();
      expect(Array.isArray(runningJobs)).toBeTruthy();
    });
  });
}); 