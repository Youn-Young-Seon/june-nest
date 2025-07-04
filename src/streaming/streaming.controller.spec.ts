import { Test, TestingModule } from '@nestjs/testing';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { PrismaService } from '../common/prisma.service';

describe('StreamingController', () => {
  let controller: StreamingController;
  let service: StreamingService;

  const mockStreamingService = {
    startStreamProcessing: jest.fn(),
    stopStreamProcessing: jest.fn(),
    monitorVideoUploads: jest.fn(),
    generateSystemMetrics: jest.fn(),
    getRealTimeStats: jest.fn(),
    processEventBatch: jest.fn(),
    sampleEventStream: jest.fn(),
    filterEventStream: jest.fn(),
    analyzeEventWindow: jest.fn(),
    analyzeEventTrends: jest.fn(),
    subscribeToStream: jest.fn(),
    unsubscribeFromStream: jest.fn(),
  };

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
      controllers: [StreamingController],
      providers: [
        {
          provide: StreamingService,
          useValue: mockStreamingService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<StreamingController>(StreamingController);
    service = module.get<StreamingService>(StreamingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startStreaming', () => {
    it('should start stream processing successfully', async () => {
      mockStreamingService.startStreamProcessing.mockResolvedValue(undefined);

      const result = await controller.startStreaming();

      expect(result).toEqual({
        message: 'Stream processing started successfully',
        status: 'running'
      });
      expect(service.startStreamProcessing).toHaveBeenCalled();
    });

    it('should handle errors when starting stream processing', async () => {
      mockStreamingService.startStreamProcessing.mockRejectedValue(
        new Error('Start failed')
      );

      const result = await controller.startStreaming();

      expect(result).toEqual({
        message: 'Failed to start stream processing',
        status: 'error'
      });
    });
  });

  describe('stopStreaming', () => {
    it('should stop stream processing successfully', async () => {
      mockStreamingService.stopStreamProcessing.mockResolvedValue(undefined);

      const result = await controller.stopStreaming();

      expect(result).toEqual({
        message: 'Stream processing stopped successfully',
        status: 'stopped'
      });
      expect(service.stopStreamProcessing).toHaveBeenCalled();
    });

    it('should handle errors when stopping stream processing', async () => {
      mockStreamingService.stopStreamProcessing.mockRejectedValue(
        new Error('Stop failed')
      );

      const result = await controller.stopStreaming();

      expect(result).toEqual({
        message: 'Failed to stop stream processing',
        status: 'error'
      });
    });
  });

  describe('getVideoUploads', () => {
    it('should return video upload events', async () => {
      const mockEvents = [
        {
          id: 'upload-1',
          type: 'VIDEO_UPLOAD',
          timestamp: new Date(),
          data: {
            videoId: 1,
            userId: 1,
            filename: 'test.mp4',
            size: 1000,
            status: 'COMPLETED'
          }
        }
      ];

      mockStreamingService.monitorVideoUploads.mockResolvedValue(mockEvents);

      const result = await controller.getVideoUploads();

      expect(result).toEqual({
        success: true,
        events: mockEvents,
        count: 1
      });
      expect(service.monitorVideoUploads).toHaveBeenCalled();
    });

    it('should handle errors when getting video uploads', async () => {
      mockStreamingService.monitorVideoUploads.mockRejectedValue(
        new Error('Monitor failed')
      );

      const result = await controller.getVideoUploads();

      expect(result).toEqual({
        success: false,
        events: [],
        count: 0
      });
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', async () => {
      const mockMetrics = [
        {
          id: 'metric-1',
          type: 'SYSTEM_METRIC',
          timestamp: new Date(),
          data: {
            metricName: 'cpu_usage',
            value: 75.5,
            unit: 'percentage'
          }
        }
      ];

      mockStreamingService.generateSystemMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getSystemMetrics();

      expect(result).toEqual({
        success: true,
        metrics: mockMetrics,
        count: 1
      });
      expect(service.generateSystemMetrics).toHaveBeenCalled();
    });

    it('should handle errors when getting system metrics', async () => {
      mockStreamingService.generateSystemMetrics.mockRejectedValue(
        new Error('Metrics failed')
      );

      const result = await controller.getSystemMetrics();

      expect(result).toEqual({
        success: false,
        metrics: [],
        count: 0
      });
    });
  });

  describe('getRealTimeStats', () => {
    it('should return real-time stats', async () => {
      const mockStats = {
        totalEvents: 100,
        eventsPerSecond: 5.5,
        videoUploads: 25,
        activeUsers: 50,
        systemLoad: 70.0,
        lastUpdated: new Date()
      };

      mockStreamingService.getRealTimeStats.mockReturnValue(mockStats);

      const result = await controller.getRealTimeStats();

      expect(result).toEqual({
        success: true,
        stats: mockStats
      });
      expect(service.getRealTimeStats).toHaveBeenCalled();
    });

    it('should handle errors when getting real-time stats', async () => {
      mockStreamingService.getRealTimeStats.mockImplementation(() => {
        throw new Error('Stats failed');
      });

      const result = await controller.getRealTimeStats();

      expect(result.success).toBe(false);
      expect(result.stats).toEqual({
        totalEvents: 0,
        eventsPerSecond: 0,
        videoUploads: 0,
        activeUsers: 0,
        systemLoad: 0,
        lastUpdated: expect.any(Date)
      });
    });
  });

  describe('processBatch', () => {
    it('should process batch with default size', async () => {
      mockStreamingService.processEventBatch.mockResolvedValue(undefined);

      const result = await controller.processBatch();

      expect(result).toEqual({
        success: true,
        message: 'Batch processing completed successfully',
        batchSize: 20
      });
      expect(service.processEventBatch).toHaveBeenCalledWith(20);
    });

    it('should process batch with custom size', async () => {
      mockStreamingService.processEventBatch.mockResolvedValue(undefined);

      const result = await controller.processBatch('50');

      expect(result).toEqual({
        success: true,
        message: 'Batch processing completed successfully',
        batchSize: 50
      });
      expect(service.processEventBatch).toHaveBeenCalledWith(50);
    });

    it('should handle errors when processing batch', async () => {
      mockStreamingService.processEventBatch.mockRejectedValue(
        new Error('Batch failed')
      );

      const result = await controller.processBatch();

      expect(result).toEqual({
        success: false,
        message: 'Batch processing failed',
        batchSize: 20
      });
    });
  });

  describe('sampleEventStream', () => {
    it('should sample event stream', async () => {
      const mockEvents = [
        { id: '1', type: 'SYSTEM_METRIC', timestamp: new Date(), data: {} },
        { id: '2', type: 'SYSTEM_METRIC', timestamp: new Date(), data: {} }
      ];
      const mockSampledEvents = [mockEvents[0]];

      mockStreamingService.generateSystemMetrics.mockResolvedValue(mockEvents);
      mockStreamingService.sampleEventStream.mockResolvedValue(mockSampledEvents);

      const result = await controller.sampleEventStream({ sampleRate: 0.5 });

      expect(result).toEqual({
        success: true,
        sampledEvents: mockSampledEvents,
        originalCount: 2,
        sampledCount: 1,
        sampleRate: 0.5
      });
      expect(service.sampleEventStream).toHaveBeenCalledWith(mockEvents, 0.5);
    });

    it('should handle errors when sampling event stream', async () => {
      mockStreamingService.generateSystemMetrics.mockRejectedValue(
        new Error('Sample failed')
      );

      const result = await controller.sampleEventStream({ sampleRate: 0.1 });

      expect(result).toEqual({
        success: false,
        sampledEvents: [],
        originalCount: 0,
        sampledCount: 0,
        sampleRate: 0.1
      });
    });
  });

  describe('filterEventStream', () => {
    it('should filter event stream', async () => {
      const mockEvents = [
        { id: '1', type: 'SYSTEM_METRIC', timestamp: new Date(), data: {} },
        { id: '2', type: 'VIDEO_UPLOAD', timestamp: new Date(), data: {} }
      ];
      const mockFilteredEvents = [mockEvents[0]];

      mockStreamingService.generateSystemMetrics.mockResolvedValue(mockEvents);
      mockStreamingService.filterEventStream.mockResolvedValue(mockFilteredEvents);

      const filterDto = {
        eventTypes: ['SYSTEM_METRIC'],
        userId: 1
      };

      const result = await controller.filterEventStream(filterDto);

      expect(result).toEqual({
        success: true,
        filteredEvents: mockFilteredEvents,
        originalCount: 2,
        filteredCount: 1,
        filters: filterDto
      });
    });

    it('should handle errors when filtering event stream', async () => {
      mockStreamingService.generateSystemMetrics.mockRejectedValue(
        new Error('Filter failed')
      );

      const result = await controller.filterEventStream({ eventTypes: ['SYSTEM_METRIC'] });

      expect(result).toEqual({
        success: false,
        filteredEvents: [],
        originalCount: 0,
        filteredCount: 0,
        filters: { eventTypes: ['SYSTEM_METRIC'] }
      });
    });
  });

  describe('analyzeEventWindow', () => {
    it('should analyze event window', async () => {
      const mockEvents = [
        { id: '1', type: 'SYSTEM_METRIC', timestamp: new Date(), data: {} }
      ];
      const mockAnalysis = {
        totalEvents: 1,
        eventCounts: { 'SYSTEM_METRIC': 1 },
        topEventType: 'SYSTEM_METRIC'
      };

      mockStreamingService.generateSystemMetrics.mockResolvedValue(mockEvents);
      mockStreamingService.analyzeEventWindow.mockResolvedValue(mockAnalysis);

      const result = await controller.analyzeEventWindow('30');

      expect(result).toEqual({
        success: true,
        analysis: mockAnalysis,
        windowSizeSeconds: 30
      });
      expect(service.analyzeEventWindow).toHaveBeenCalledWith(mockEvents);
    });

    it('should handle errors when analyzing event window', async () => {
      mockStreamingService.generateSystemMetrics.mockRejectedValue(
        new Error('Analysis failed')
      );

      const result = await controller.analyzeEventWindow();

      expect(result).toEqual({
        success: false,
        analysis: null,
        windowSizeSeconds: 60
      });
    });
  });

  describe('subscribeToStream', () => {
    it('should subscribe to stream', async () => {
      const subscribeDto = {
        id: 'test-subscriber',
        eventTypes: ['VIDEO_UPLOAD']
      };

      mockStreamingService.subscribeToStream.mockResolvedValue('test-subscriber');

      const result = await controller.subscribeToStream(subscribeDto);

      expect(result).toEqual({
        success: true,
        subscriberId: 'test-subscriber',
        message: 'Successfully subscribed to stream'
      });
      expect(service.subscribeToStream).toHaveBeenCalledWith({
        id: 'test-subscriber',
        eventTypes: ['VIDEO_UPLOAD'],
        onEvent: expect.any(Function)
      });
    });

    it('should handle errors when subscribing to stream', async () => {
      mockStreamingService.subscribeToStream.mockRejectedValue(
        new Error('Subscribe failed')
      );

      const result = await controller.subscribeToStream({
        id: 'test-subscriber',
        eventTypes: ['VIDEO_UPLOAD']
      });

      expect(result).toEqual({
        success: false,
        subscriberId: '',
        message: 'Failed to subscribe to stream'
      });
    });
  });

  describe('unsubscribeFromStream', () => {
    it('should unsubscribe from stream', async () => {
      mockStreamingService.unsubscribeFromStream.mockResolvedValue(true);

      const result = await controller.unsubscribeFromStream('test-subscriber');

      expect(result).toEqual({
        success: true,
        message: 'Successfully unsubscribed'
      });
      expect(service.unsubscribeFromStream).toHaveBeenCalledWith('test-subscriber');
    });

    it('should handle subscription not found', async () => {
      mockStreamingService.unsubscribeFromStream.mockResolvedValue(false);

      const result = await controller.unsubscribeFromStream('nonexistent');

      expect(result).toEqual({
        success: false,
        message: 'Subscription not found'
      });
    });

    it('should handle errors when unsubscribing from stream', async () => {
      mockStreamingService.unsubscribeFromStream.mockRejectedValue(
        new Error('Unsubscribe failed')
      );

      const result = await controller.unsubscribeFromStream('test-subscriber');

      expect(result).toEqual({
        success: false,
        message: 'Failed to unsubscribe from stream'
      });
    });
  });

  describe('streamingDemo', () => {
    it('should run streaming demo successfully', async () => {
      const mockVideoUploads = [
        { id: 'upload-1', type: 'VIDEO_UPLOAD', timestamp: new Date(), data: {} }
      ];
      const mockSystemMetrics = [
        { id: 'metric-1', type: 'SYSTEM_METRIC', timestamp: new Date(), data: {} }
      ];
      const mockAnalysis = { totalEvents: 1 };
      const mockTrends = { mostActiveType: 'SYSTEM_METRIC' };
      const mockSampledEvents = [mockSystemMetrics[0]];

      mockStreamingService.monitorVideoUploads.mockResolvedValue(mockVideoUploads);
      mockStreamingService.generateSystemMetrics.mockResolvedValue(mockSystemMetrics);
      mockStreamingService.analyzeEventWindow.mockResolvedValue(mockAnalysis);
      mockStreamingService.analyzeEventTrends.mockResolvedValue(mockTrends);
      mockStreamingService.sampleEventStream.mockResolvedValue(mockSampledEvents);

      const result = await controller.streamingDemo();

      expect(result.success).toBe(true);
      expect(result.demo.videoUploads).toEqual(mockVideoUploads);
      expect(result.demo.systemMetrics).toEqual(mockSystemMetrics);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle errors in streaming demo', async () => {
      mockStreamingService.monitorVideoUploads.mockRejectedValue(
        new Error('Demo failed')
      );

      const result = await controller.streamingDemo();

      expect(result.success).toBe(false);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });
}); 