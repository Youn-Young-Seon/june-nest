import { Controller, Get, Post, Query, Body, Param, Logger, Sse } from '@nestjs/common';
import { StreamingService, StreamEvent, VideoUploadEvent, RealTimeStats } from './streaming.service';
import { Observable, interval, map } from 'rxjs';

// 🌊 스트림 필터 DTO
export class StreamFilterDto {
  eventTypes?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  userId?: number;
}

// 📊 샘플링 요청 DTO
export class SampleRequestDto {
  sampleRate: number = 0.1;
}

@Controller('streaming')
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(private readonly streamingService: StreamingService) {}

  // 🚀 스트림 처리 시작
  @Post('start')
  async startStreaming(): Promise<{ message: string; status: string }> {
    this.logger.log('🚀 Starting streaming via API');
    
    try {
      await this.streamingService.startStreamProcessing();
      return {
        message: 'Stream processing started successfully',
        status: 'running'
      };
    } catch (error) {
      this.logger.error('Error starting streaming:', error);
      return {
        message: 'Failed to start stream processing',
        status: 'error'
      };
    }
  }

  // 🛑 스트림 처리 중지
  @Post('stop')
  async stopStreaming(): Promise<{ message: string; status: string }> {
    this.logger.log('🛑 Stopping streaming via API');
    
    try {
      await this.streamingService.stopStreamProcessing();
      return {
        message: 'Stream processing stopped successfully',
        status: 'stopped'
      };
    } catch (error) {
      this.logger.error('Error stopping streaming:', error);
      return {
        message: 'Failed to stop stream processing',
        status: 'error'
      };
    }
  }

  // 📡 실시간 비디오 업로드 모니터링
  @Get('video-uploads')
  async getVideoUploads(): Promise<{
    success: boolean;
    events: VideoUploadEvent[];
    count: number;
  }> {
    this.logger.log('📹 Getting video upload events via API');
    
    try {
      const events = await this.streamingService.monitorVideoUploads();
      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      this.logger.error('Error getting video uploads:', error);
      return {
        success: false,
        events: [],
        count: 0
      };
    }
  }

  // 📊 시스템 메트릭 조회
  @Get('system-metrics')
  async getSystemMetrics(): Promise<{
    success: boolean;
    metrics: StreamEvent[];
    count: number;
  }> {
    this.logger.log('📊 Getting system metrics via API');
    
    try {
      const metrics = await this.streamingService.generateSystemMetrics();
      return {
        success: true,
        metrics,
        count: metrics.length
      };
    } catch (error) {
      this.logger.error('Error getting system metrics:', error);
      return {
        success: false,
        metrics: [],
        count: 0
      };
    }
  }

  // 📊 실시간 통계 조회
  @Get('stats')
  async getRealTimeStats(): Promise<{
    success: boolean;
    stats: RealTimeStats;
  }> {
    this.logger.log('📊 Getting real-time stats via API');
    
    try {
      const stats = this.streamingService.getRealTimeStats();
      return {
        success: true,
        stats
      };
    } catch (error) {
      this.logger.error('Error getting real-time stats:', error);
      return {
        success: false,
        stats: {
          totalEvents: 0,
          eventsPerSecond: 0,
          videoUploads: 0,
          activeUsers: 0,
          systemLoad: 0,
          lastUpdated: new Date()
        }
      };
    }
  }

  // 🔄 이벤트 배치 처리
  @Post('process-batch')
  async processBatch(@Query('size') size: string = '20'): Promise<{
    success: boolean;
    message: string;
    batchSize: number;
  }> {
    const batchSize = parseInt(size, 10);
    this.logger.log(`🔄 Processing batch of ${batchSize} events via API`);
    
    try {
      await this.streamingService.processEventBatch(batchSize);
      return {
        success: true,
        message: 'Batch processing completed successfully',
        batchSize
      };
    } catch (error) {
      this.logger.error('Error processing batch:', error);
      return {
        success: false,
        message: 'Batch processing failed',
        batchSize
      };
    }
  }

  // 🌊 이벤트 스트림 샘플링
  @Post('sample')
  async sampleEventStream(@Body() sampleRequest: SampleRequestDto): Promise<{
    success: boolean;
    sampledEvents: StreamEvent[];
    originalCount: number;
    sampledCount: number;
    sampleRate: number;
  }> {
    this.logger.log(`🎯 Sampling event stream with rate: ${sampleRequest.sampleRate}`);
    
    try {
      // 먼저 모든 이벤트 생성
      const allEvents = await this.streamingService.generateSystemMetrics();
      
      // 샘플링 적용
      const sampledEvents = await this.streamingService.sampleEventStream(
        allEvents, 
        sampleRequest.sampleRate
      );
      
      return {
        success: true,
        sampledEvents,
        originalCount: allEvents.length,
        sampledCount: sampledEvents.length,
        sampleRate: sampleRequest.sampleRate
      };
    } catch (error) {
      this.logger.error('Error sampling event stream:', error);
      return {
        success: false,
        sampledEvents: [],
        originalCount: 0,
        sampledCount: 0,
        sampleRate: sampleRequest.sampleRate
      };
    }
  }

  // 🔍 이벤트 스트림 필터링
  @Post('filter')
  async filterEventStream(@Body() filterDto: StreamFilterDto): Promise<{
    success: boolean;
    filteredEvents: StreamEvent[];
    originalCount: number;
    filteredCount: number;
    filters: StreamFilterDto;
  }> {
    this.logger.log(`🔍 Filtering event stream with filters: ${JSON.stringify(filterDto)}`);
    
    try {
      // 먼저 모든 이벤트 생성
      const allEvents = await this.streamingService.generateSystemMetrics();
      
      // 필터 변환
      const filters = {
        eventTypes: filterDto.eventTypes as StreamEvent['type'][],
        timeRange: filterDto.timeRange ? {
          start: new Date(filterDto.timeRange.start),
          end: new Date(filterDto.timeRange.end)
        } : undefined,
        userId: filterDto.userId
      };
      
      // 필터링 적용
      const filteredEvents = await this.streamingService.filterEventStream(
        allEvents, 
        filters
      );
      
      return {
        success: true,
        filteredEvents,
        originalCount: allEvents.length,
        filteredCount: filteredEvents.length,
        filters: filterDto
      };
    } catch (error) {
      this.logger.error('Error filtering event stream:', error);
      return {
        success: false,
        filteredEvents: [],
        originalCount: 0,
        filteredCount: 0,
        filters: filterDto
      };
    }
  }

  // 📈 이벤트 윈도우 분석
  @Get('analyze-window')
  async analyzeEventWindow(@Query('windowSize') windowSize: string = '60'): Promise<{
    success: boolean;
    analysis: any;
    windowSizeSeconds: number;
  }> {
    const windowSizeSeconds = parseInt(windowSize, 10);
    this.logger.log(`📈 Analyzing event window (${windowSizeSeconds}s)`);
    
    try {
      // 샘플 이벤트 생성
      const events = await this.streamingService.generateSystemMetrics();
      
      // 윈도우 분석
      const analysis = await this.streamingService.analyzeEventWindow(events);
      
      return {
        success: true,
        analysis,
        windowSizeSeconds
      };
    } catch (error) {
      this.logger.error('Error analyzing event window:', error);
      return {
        success: false,
        analysis: null,
        windowSizeSeconds
      };
    }
  }

  // 📊 이벤트 트렌드 분석
  @Get('analyze-trends')
  async analyzeEventTrends(): Promise<{
    success: boolean;
    trends: any;
    eventCount: number;
  }> {
    this.logger.log('📈 Analyzing event trends');
    
    try {
      // 샘플 이벤트 생성 (더 많은 이벤트로 트렌드 분석)
      const events = await this.streamingService.generateSystemMetrics();
      
      // 트렌드 분석
      const trends = await this.streamingService.analyzeEventTrends(events);
      
      return {
        success: true,
        trends,
        eventCount: events.length
      };
    } catch (error) {
      this.logger.error('Error analyzing event trends:', error);
      return {
        success: false,
        trends: null,
        eventCount: 0
      };
    }
  }

  // 🎯 스트림 구독
  @Post('subscribe')
  async subscribeToStream(@Body() subscribeDto: {
    id: string;
    eventTypes: string[];
  }): Promise<{
    success: boolean;
    subscriberId: string;
    message: string;
  }> {
    this.logger.log(`📡 Creating stream subscription: ${subscribeDto.id}`);
    
    try {
      const subscriberId = await this.streamingService.subscribeToStream({
        id: subscribeDto.id,
        eventTypes: subscribeDto.eventTypes as StreamEvent['type'][],
        onEvent: async (event) => {
          // 실제 구현에서는 WebSocket이나 SSE로 클라이언트에게 전송
          this.logger.log(`🔔 Event notification for ${subscribeDto.id}: ${event.type}`);
        }
      });
      
      return {
        success: true,
        subscriberId,
        message: 'Successfully subscribed to stream'
      };
    } catch (error) {
      this.logger.error('Error subscribing to stream:', error);
      return {
        success: false,
        subscriberId: '',
        message: 'Failed to subscribe to stream'
      };
    }
  }

  // 📤 스트림 구독 해제
  @Post('unsubscribe/:subscriberId')
  async unsubscribeFromStream(@Param('subscriberId') subscriberId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`📤 Unsubscribing from stream: ${subscriberId}`);
    
    try {
      const removed = await this.streamingService.unsubscribeFromStream(subscriberId);
      
      return {
        success: removed,
        message: removed ? 'Successfully unsubscribed' : 'Subscription not found'
      };
    } catch (error) {
      this.logger.error('Error unsubscribing from stream:', error);
      return {
        success: false,
        message: 'Failed to unsubscribe from stream'
      };
    }
  }

  // 🌊 Server-Sent Events 스트림 (실시간 통계)
  @Sse('stats-stream')
  streamStats(): Observable<{ data: RealTimeStats }> {
    this.logger.log('📡 Starting SSE stats stream');
    
    return interval(2000).pipe(
      map(() => ({
        data: this.streamingService.getRealTimeStats()
      }))
    );
  }

  // 🔥 FxTS 스트림 데모
  @Get('demo')
  async streamingDemo(): Promise<{
    success: boolean;
    demo: {
      videoUploads: VideoUploadEvent[];
      systemMetrics: StreamEvent[];
      windowAnalysis: any;
      trends: any;
      sampledEvents: StreamEvent[];
    };
    processingTime: number;
  }> {
    this.logger.log('🎬 Running FxTS streaming demo');
    
    const startTime = performance.now();
    
    try {
      // 병렬로 다양한 스트림 처리 데모 실행
      const [
        videoUploads,
        systemMetrics,
        allEvents
      ] = await Promise.all([
        this.streamingService.monitorVideoUploads(),
        this.streamingService.generateSystemMetrics(),
        this.streamingService.generateSystemMetrics() // 분석용 추가 이벤트
      ]);

      // 윈도우 분석 및 트렌드 분석
      const [windowAnalysis, trends] = await Promise.all([
        this.streamingService.analyzeEventWindow(allEvents),
        this.streamingService.analyzeEventTrends(allEvents)
      ]);

      // 샘플링 데모
      const sampledEvents = await this.streamingService.sampleEventStream(allEvents, 0.3);

      const processingTime = performance.now() - startTime;

      return {
        success: true,
        demo: {
          videoUploads,
          systemMetrics,
          windowAnalysis,
          trends,
          sampledEvents
        },
        processingTime
      };
    } catch (error) {
      this.logger.error('Error running streaming demo:', error);
      
      const processingTime = performance.now() - startTime;
      
      return {
        success: false,
        demo: {
          videoUploads: [],
          systemMetrics: [],
          windowAnalysis: null,
          trends: null,
          sampledEvents: []
        },
        processingTime
      };
    }
  }
} 