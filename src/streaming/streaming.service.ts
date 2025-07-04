import { Injectable, Logger } from '@nestjs/common';
import { 
  pipe, 
  toAsync, 
  filter, 
  map, 
  take, 
  delay,
  tap,
  chunk,
  toArray
} from '@fxts/core';
import { PrismaService } from '../common/prisma.service';

// 🌊 스트리밍 이벤트 타입들
export interface StreamEvent {
  id: string;
  type: 'VIDEO_UPLOAD' | 'USER_ACTIVITY' | 'SYSTEM_METRIC';
  timestamp: Date;
  data: any;
}

export interface VideoUploadEvent extends StreamEvent {
  type: 'VIDEO_UPLOAD';
  data: {
    videoId: number;
    userId: number;
    filename: string;
    size: number;
    status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED';
  };
}

// 📊 실시간 통계
export interface RealTimeStats {
  totalEvents: number;
  eventsPerSecond: number;
  videoUploads: number;
  activeUsers: number;
  systemLoad: number;
  lastUpdated: Date;
}

// 📡 스트림 구독자
export interface StreamSubscriber {
  id: string;
  eventTypes: StreamEvent['type'][];
  onEvent: (event: StreamEvent) => Promise<void> | void;
  isActive: boolean;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private eventStream: StreamEvent[] = [];
  private subscribers = new Map<string, StreamSubscriber>();
  private isStreaming = false;
  private currentStats: RealTimeStats = {
    totalEvents: 0,
    eventsPerSecond: 0,
    videoUploads: 0,
    activeUsers: 0,
    systemLoad: 0,
    lastUpdated: new Date()
  };

  constructor(private prisma: PrismaService) {}

  // 🚀 스트림 처리 시작
  async startStreamProcessing(): Promise<void> {
    if (this.isStreaming) {
      this.logger.warn('Stream processing is already running');
      return;
    }

    this.isStreaming = true;
    this.logger.log('🚀 Starting FxTS stream processing');

    // 백그라운드에서 스트림 처리 실행
    this.processStreamInBackground();
  }

  // 📡 실시간 비디오 업로드 모니터링
  async monitorVideoUploads(): Promise<VideoUploadEvent[]> {
    this.logger.log('📹 Monitoring video uploads with FxTS');
    
    try {
      // 최근 업로드된 비디오들 조회
      const recentUploads = await this.prisma.video.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // 최근 5분
          }
        },
        include: { uploadedBy: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      // 🔥 FxTS를 활용한 업로드 이벤트 스트림 생성
      const uploadEvents = await pipe(
        recentUploads,
        toAsync,
        filter(video => video.uploadedBy !== null), // 유효한 업로더가 있는 비디오만
        map((video): VideoUploadEvent => ({
          id: `upload-${video.idx}-${Date.now()}`,
          type: 'VIDEO_UPLOAD',
          timestamp: new Date(),
          data: {
            videoId: video.idx,
            userId: video.uploadedById,
            filename: video.fileName,
            size: video.size,
            status: video.thumbnailPath ? 'COMPLETED' : 'PROCESSING'
          }
        })),
        toArray,
        // 배열로 변환 후 tap 적용
        tap(events => events.forEach(event => 
          this.logger.log(`📹 Video upload event: ${event.data.filename}`)
        ))
      );

      return uploadEvents;
      
    } catch (error) {
      this.logger.error('Error monitoring video uploads:', error);
      return [];
    }
  }

  // 📈 시스템 메트릭 생성
  async generateSystemMetrics(): Promise<StreamEvent[]> {
    this.logger.log('📊 Generating system metrics with FxTS');
    
    try {
      // 🔥 FxTS를 활용한 메트릭 생성
      const metrics = await pipe(
        [
          'cpu_usage',
          'memory_usage', 
          'disk_usage',
          'network_io',
          'active_connections'
        ],
        toAsync,
        map((metricName): StreamEvent => ({
          id: `metric-${metricName}-${Date.now()}`,
          type: 'SYSTEM_METRIC',
          timestamp: new Date(),
          data: {
            metricName,
            value: Math.random() * 100, // 시뮬레이션
            unit: metricName.includes('usage') ? 'percentage' : 'count',
            tags: {
              server: 'app-server-1',
              environment: 'production'
            }
          }
        })),
        toArray,
        tap(metrics => metrics.forEach(metric => 
          this.logger.log(`📊 System metric: ${metric.data.metricName} = ${metric.data.value.toFixed(2)}`)
        ))
      );

      return metrics;
      
    } catch (error) {
      this.logger.error('Error generating system metrics:', error);
      return [];
    }
  }

  // 📊 이벤트 윈도우 분석
  async analyzeEventWindow(events: StreamEvent[]): Promise<any> {
    this.logger.log(`📈 Analyzing event window with ${events.length} events`);
    
    try {
      // 🔥 FxTS를 활용한 윈도우 분석
      const analysis = await pipe(
        events,
        toAsync,
        toArray,
        
        // 분석 수행
        (eventArray) => {
          const eventCounts = eventArray.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const topEventType = Object.entries(eventCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
          
          return {
            windowStart: new Date(Date.now() - 60000), // 1분 전
            windowEnd: new Date(),
            eventCounts,
            totalEvents: eventArray.length,
            eventsPerSecond: eventArray.length / 60, // 1분 기준
            topEventType,
            videoUploads: eventCounts['VIDEO_UPLOAD'] || 0,
            userActivities: eventCounts['USER_ACTIVITY'] || 0,
            systemMetrics: eventCounts['SYSTEM_METRIC'] || 0
          };
        }
      );

      this.logger.log(`📈 Window analysis complete: ${analysis.totalEvents} events, top type: ${analysis.topEventType}`);
      return analysis;
      
    } catch (error) {
      this.logger.error('Error analyzing event window:', error);
      return null;
    }
  }

  // 🌊 이벤트 스트림 샘플링
  async sampleEventStream(events: StreamEvent[], sampleRate: number = 0.1): Promise<StreamEvent[]> {
    this.logger.log(`🎯 Sampling event stream with rate: ${sampleRate}`);
    
    try {
      // 🔥 FxTS를 활용한 샘플링
      const sampledEvents = await pipe(
        events,
        toAsync,
        filter(() => Math.random() < sampleRate), // 샘플 레이트에 따른 필터링
        toArray,
        tap(events => events.forEach(event => 
          this.logger.log(`🎯 Sampled event: ${event.type} - ${event.id}`)
        ))
      );

      this.logger.log(`🎯 Sampled ${sampledEvents.length} events from ${events.length} total`);
      return sampledEvents;
      
    } catch (error) {
      this.logger.error('Error sampling event stream:', error);
      return [];
    }
  }

  // 🔄 실시간 배치 처리
  async processEventBatch(batchSize: number = 20): Promise<void> {
    this.logger.log(`🔄 Processing event batch (size: ${batchSize})`);
    
    try {
      // 최근 이벤트들 생성
      const events = await this.generateMockEvents(batchSize);
      
      // 🔥 FxTS를 활용한 배치 처리
      const processedBatch = await pipe(
        events,
        toAsync,
        
        // 청크 단위 처리
        chunk(5), // 5개씩 청크로 처리
        
        // 각 청크 처리
        map(async (eventChunk) => {
          this.logger.log(`📦 Processing chunk of ${eventChunk.length} events`);
          
          const processed = await pipe(
            eventChunk,
            toAsync,
            map(async (event) => {
              // 이벤트 처리 시뮬레이션
              await delay(100);
              await this.processEvent(event);
              return event;
            }),
            toArray
          );
          
          return processed;
        }),
        
        toArray
      );

      const totalProcessed = processedBatch.flat().length;
      this.logger.log(`✅ Batch processing complete: ${totalProcessed} events processed`);
      
    } catch (error) {
      this.logger.error('Error processing event batch:', error);
    }
  }

  // 🌊 실시간 스트림 필터링
  async filterEventStream(events: StreamEvent[], filters: {
    eventTypes?: StreamEvent['type'][];
    timeRange?: { start: Date; end: Date };
    userId?: number;
  }): Promise<StreamEvent[]> {
    this.logger.log(`🔍 Filtering event stream with filters: ${JSON.stringify(filters)}`);
    
    try {
      // 🔥 FxTS를 활용한 다중 필터링
      const filteredEvents = await pipe(
        events,
        toAsync,
        
        // 이벤트 타입 필터
        filter(event => {
          if (filters.eventTypes && !filters.eventTypes.includes(event.type)) {
            return false;
          }
          return true;
        }),
        
        // 시간 범위 필터
        filter(event => {
          if (filters.timeRange) {
            const eventTime = event.timestamp.getTime();
            const startTime = filters.timeRange.start.getTime();
            const endTime = filters.timeRange.end.getTime();
            return eventTime >= startTime && eventTime <= endTime;
          }
          return true;
        }),
        
        // 사용자 ID 필터
        filter(event => {
          if (filters.userId && event.data.userId) {
            return event.data.userId === filters.userId;
          }
          return true;
        }),
        
        toArray,
        tap(events => events.forEach(event => 
          this.logger.log(`🔍 Filtered event: ${event.type} - ${event.id}`)
        ))
      );

      this.logger.log(`🔍 Filtered ${filteredEvents.length} events from ${events.length} total`);
      return filteredEvents;
      
    } catch (error) {
      this.logger.error('Error filtering event stream:', error);
      return [];
    }
  }

  // 🎯 스트림 구독 관리
  async subscribeToStream(subscriber: Omit<StreamSubscriber, 'isActive'>): Promise<string> {
    const fullSubscriber: StreamSubscriber = {
      ...subscriber,
      isActive: true
    };
    
    this.subscribers.set(subscriber.id, fullSubscriber);
    this.logger.log(`📡 New subscriber: ${subscriber.id} for events: ${subscriber.eventTypes.join(', ')}`);
    
    return subscriber.id;
  }

  async unsubscribeFromStream(subscriberId: string): Promise<boolean> {
    const removed = this.subscribers.delete(subscriberId);
    if (removed) {
      this.logger.log(`📤 Unsubscribed: ${subscriberId}`);
    }
    return removed;
  }

  // 📊 실시간 통계 조회
  getRealTimeStats(): RealTimeStats {
    return { ...this.currentStats };
  }

  // 📈 이벤트 트렌드 분석
  async analyzeEventTrends(events: StreamEvent[]): Promise<any> {
    this.logger.log('📈 Analyzing event trends with FxTS');
    
    try {
      // 🔥 FxTS를 활용한 트렌드 분석
      const trendAnalysis = await pipe(
        events,
        toAsync,
        
        // 시간별 그룹화를 위한 변환
        map(event => ({
          ...event,
          hour: event.timestamp.getHours(),
          minute: Math.floor(event.timestamp.getMinutes() / 10) * 10 // 10분 단위
        })),
        
        toArray,
        
        // 트렌드 분석
        (eventArray) => {
          const hourlyTrends = eventArray.reduce((acc, event) => {
            const key = `${event.hour}:${event.minute}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const typeTrends = eventArray.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          return {
            hourlyTrends,
            typeTrends,
            totalEvents: eventArray.length,
            peakHour: Object.entries(hourlyTrends)
              .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none',
            mostActiveType: Object.entries(typeTrends)
              .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
          };
        }
      );

      this.logger.log(`📈 Trend analysis: Peak hour: ${trendAnalysis.peakHour}, Most active: ${trendAnalysis.mostActiveType}`);
      return trendAnalysis;
      
    } catch (error) {
      this.logger.error('Error analyzing event trends:', error);
      return null;
    }
  }

  // 🛑 스트림 처리 중지
  async stopStreamProcessing(): Promise<void> {
    this.isStreaming = false;
    this.subscribers.clear();
    this.logger.log('🛑 Stream processing stopped');
  }

  // 🔧 Private 헬퍼 메서드들
  private async processStreamInBackground(): Promise<void> {
    try {
      while (this.isStreaming) {
        // 주기적으로 이벤트 생성 및 처리
        await this.processEventBatch(10);
        
        // 구독자들에게 알림
        await this.notifySubscribers();
        
        // 통계 업데이트
        this.updateRealTimeStats();
        
        // 다음 사이클까지 대기
        await delay(5000); // 5초 간격
      }
    } catch (error) {
      this.logger.error('Background stream processing error:', error);
      this.isStreaming = false;
    }
  }

  private async processEvent(event: StreamEvent): Promise<void> {
    // 이벤트 저장
    this.eventStream.push(event);
    
    // 메모리 제한
    if (this.eventStream.length > 1000) {
      this.eventStream.splice(0, this.eventStream.length - 500);
    }
  }

  private async generateMockEvents(count: number): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];
    
    for (let i = 0; i < count; i++) {
      const eventType = this.getRandomEventType();
      const event: StreamEvent = {
        id: `mock-event-${Date.now()}-${i}`,
        type: eventType,
        timestamp: new Date(),
        data: this.generateMockEventData(eventType)
      };
      
      events.push(event);
    }
    
    return events;
  }

  private getRandomEventType(): StreamEvent['type'] {
    const types: StreamEvent['type'][] = ['VIDEO_UPLOAD', 'USER_ACTIVITY', 'SYSTEM_METRIC'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateMockEventData(type: StreamEvent['type']): any {
    switch (type) {
      case 'VIDEO_UPLOAD':
        return {
          videoId: Math.floor(Math.random() * 1000),
          userId: Math.floor(Math.random() * 100),
          filename: `video_${Date.now()}.mp4`,
          size: Math.floor(Math.random() * 1000000),
          status: 'UPLOADING'
        };
        
      case 'USER_ACTIVITY':
        const actions = ['LOGIN', 'LOGOUT', 'VIDEO_VIEW', 'VIDEO_LIKE', 'VIDEO_SHARE'];
        return {
          userId: Math.floor(Math.random() * 100),
          action: actions[Math.floor(Math.random() * actions.length)],
          metadata: { ip: '192.168.1.100', userAgent: 'MockBrowser' }
        };
        
      case 'SYSTEM_METRIC':
        return {
          metricName: 'active_users',
          value: Math.floor(Math.random() * 1000),
          unit: 'count',
          tags: { server: 'app-1' }
        };
        
      default:
        return {};
    }
  }

  private updateRealTimeStats(): void {
    this.currentStats.totalEvents = this.eventStream.length;
    this.currentStats.lastUpdated = new Date();
    
    // 비디오 업로드 카운트
    this.currentStats.videoUploads = this.eventStream
      .filter(event => event.type === 'VIDEO_UPLOAD').length;
    
    // 간단한 EPS 계산
    this.currentStats.eventsPerSecond = Math.random() * 10; // 시뮬레이션
    this.currentStats.systemLoad = Math.random() * 100;
  }

  private async notifySubscribers(): Promise<void> {
    if (this.eventStream.length === 0) return;
    
    const recentEvents = this.eventStream.slice(-10); // 최근 10개 이벤트
    
    for (const subscriber of this.subscribers.values()) {
      if (!subscriber.isActive) continue;
      
      try {
        for (const event of recentEvents) {
          if (subscriber.eventTypes.includes(event.type)) {
            await subscriber.onEvent(event);
          }
        }
      } catch (error) {
        this.logger.error(`Error notifying subscriber ${subscriber.id}:`, error);
      }
    }
  }
} 