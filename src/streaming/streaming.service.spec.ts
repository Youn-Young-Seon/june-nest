import { Test, TestingModule } from '@nestjs/testing';
import { StreamingService } from './streaming.service';
import { PrismaService } from '../common/prisma.service';

describe('StreamingService', () => {
  let service: StreamingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    video: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StreamingService>(StreamingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('monitorVideoUploads', () => {
    it('should monitor video uploads with FxTS pipeline', async () => {
      const mockVideos = [
        {
          idx: 1,
          fileName: 'test.mp4',
          size: 1000,
          thumbnailPath: 'thumb.jpg',
          uploadedById: 1,
          uploadedBy: { idx: 1, name: 'Test User' },
          createdAt: new Date(),
        },
      ];

      mockPrismaService.video.findMany.mockResolvedValue(mockVideos);

      const result = await service.monitorVideoUploads();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'VIDEO_UPLOAD',
        data: {
          videoId: 1,
          userId: 1,
          filename: 'test.mp4',
          size: 1000,
          status: 'COMPLETED',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.video.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.monitorVideoUploads();

      expect(result).toEqual([]);
    });
  });

  describe('generateSystemMetrics', () => {
    it('should generate system metrics with FxTS pipeline', async () => {
      const result = await service.generateSystemMetrics();

      expect(result).toHaveLength(5);
      expect(result[0]).toMatchObject({
        type: 'SYSTEM_METRIC',
        data: {
          metricName: 'cpu_usage',
          value: expect.any(Number),
          unit: 'percentage',
        },
      });
    });
  });

  describe('analyzeEventWindow', () => {
    it('should analyze event window with FxTS pipeline', async () => {
      const mockEvents = [
        {
          id: '1',
          type: 'VIDEO_UPLOAD' as const,
          timestamp: new Date(),
          data: {},
        },
        {
          id: '2',
          type: 'SYSTEM_METRIC' as const,
          timestamp: new Date(),
          data: {},
        },
      ];

      const result = await service.analyzeEventWindow(mockEvents);

      expect(result).toMatchObject({
        totalEvents: 2,
        topEventType: expect.any(String),
        videoUploads: 1,
        systemMetrics: 1,
      });
    });

    it('should handle empty events array', async () => {
      const result = await service.analyzeEventWindow([]);

      expect(result).toMatchObject({
        totalEvents: 0,
        topEventType: 'none',
      });
    });
  });

  describe('sampleEventStream', () => {
    it('should sample event stream with FxTS pipeline', async () => {
      const mockEvents = [
        {
          id: '1',
          type: 'SYSTEM_METRIC' as const,
          timestamp: new Date(),
          data: {},
        },
        {
          id: '2',
          type: 'SYSTEM_METRIC' as const,
          timestamp: new Date(),
          data: {},
        },
      ];

      const result = await service.sampleEventStream(mockEvents, 0.5);

      expect(result.length).toBeLessThanOrEqual(mockEvents.length);
    });
  });

  describe('processEventBatch', () => {
    it('should process event batch with FxTS pipeline', async () => {
      const batchSize = 5;

      await expect(service.processEventBatch(batchSize)).resolves.toBeUndefined();
    });
  });

  describe('getRealTimeStats', () => {
    it('should return real-time stats', () => {
      const stats = service.getRealTimeStats();

      expect(stats).toMatchObject({
        totalEvents: expect.any(Number),
        eventsPerSecond: expect.any(Number),
        videoUploads: expect.any(Number),
        activeUsers: expect.any(Number),
        systemLoad: expect.any(Number),
        lastUpdated: expect.any(Date),
      });
    });
  });

  describe('startStreamProcessing', () => {
    it('should start stream processing', async () => {
      await service.startStreamProcessing();
      
      expect(service.getRealTimeStats()).toBeDefined();
    });
  });

  describe('stopStreamProcessing', () => {
    it('should stop stream processing', async () => {
      await service.startStreamProcessing();
      await service.stopStreamProcessing();
      
      expect(service.getRealTimeStats()).toBeDefined();
    });
  });
}); 