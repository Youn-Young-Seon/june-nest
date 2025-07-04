import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { 
  pipe, 
  filter, 
  map, 
  sortBy, 
  take, 
  toArray,
  toAsync
} from '@fxts/core';

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: Record<string, number>;
  averageVideosPerUser: number;
  topVideoUploaders: Array<{
    userId: number;
    userName: string;
    videoCount: number;
    totalSizeMB: number;
  }>;
  userGrowthByMonth: Array<{
    month: string;
    newUsers: number;
    cumulativeUsers: number;
  }>;
}

export interface VideoAnalytics {
  totalVideos: number;
  totalSizeMB: number;
  averageSizeMB: number;
  videosByMimeType: Record<string, number>;
  videosBySize: {
    small: number;    // < 10MB
    medium: number;   // 10-100MB
    large: number;    // 100MB-1GB
    xlarge: number;   // > 1GB
  };
  recentActivity: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
  uploadTrends: Array<{
    date: string;
    uploads: number;
    totalSizeMB: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getUserAnalytics(): Promise<UserAnalytics> {
    const users = await this.prisma.user.findMany({
      include: {
        Video: {
          select: {
            idx: true,
            size: true,
            createdAt: true,
          }
        }
      }
    });

    this.logger.debug(`Analyzing ${users.length} users`);

    // ✅ GOOD: 활성/비활성 사용자 분류 (간단한 방식)
    const activeUsers = users.filter(user => 
      user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const inactiveUsers = users.filter(user => 
      user.createdAt <= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    // ✅ GOOD: 역할별 사용자 분류
    const usersByRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ✅ GOOD: 평균 계산
    const averageVideosPerUser = users.reduce((sum, user) => sum + user.Video.length, 0) / users.length;

    // ✅ GOOD: 상위 업로더 분석
    const topVideoUploaders = users
      .filter(user => user.Video.length > 0)
      .map(user => ({
        userId: user.idx,
        userName: user.name || user.email,
        videoCount: user.Video.length,
        totalSizeMB: Math.round(
          user.Video.reduce((sum, video) => sum + video.size, 0) / 1024 / 1024 * 100
        ) / 100
      }))
      .sort((a, b) => b.videoCount - a.videoCount)
      .slice(0, 10);

    // ✅ GOOD: 월별 사용자 성장 분석
    const monthlyGroups = users.reduce((acc, user) => {
      const date = new Date(user.createdAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const userGrowthByMonth = Object.entries(monthlyGroups)
      .map(([month, newUsers]) => ({ month, newUsers, cumulativeUsers: 0 }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((stat, index, array) => ({
        ...stat,
        cumulativeUsers: array.slice(0, index + 1).reduce((sum, s) => sum + s.newUsers, 0)
      }));

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      inactiveUsers: inactiveUsers.length,
      usersByRole,
      averageVideosPerUser: Math.round(averageVideosPerUser * 100) / 100,
      topVideoUploaders,
      userGrowthByMonth
    };
  }

  async getVideoAnalytics(): Promise<VideoAnalytics> {
    const videos = await this.prisma.video.findMany({
      select: {
        idx: true,
        title: true,
        size: true,
        mimeType: true,
        createdAt: true,
        uploadedBy: {
          select: {
            idx: true,
            name: true,
            email: true,
          }
        }
      }
    });

    this.logger.debug(`Analyzing ${videos.length} videos`);

    // ✅ GOOD: 기본 통계 계산
    const totalVideos = videos.length;
    const totalSizeMB = videos.reduce((sum, video) => sum + video.size, 0) / 1024 / 1024;
    const averageSizeMB = totalSizeMB / totalVideos;

    // ✅ GOOD: MIME 타입별 분류
    const videosByMimeType = videos.reduce((acc, video) => {
      acc[video.mimeType] = (acc[video.mimeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ✅ GOOD: 크기별 분류
    const videosBySize = videos.reduce((acc, video) => {
      const sizeMB = video.size / 1024 / 1024;
      if (sizeMB < 10) acc.small++;
      else if (sizeMB < 100) acc.medium++;
      else if (sizeMB < 1000) acc.large++;
      else acc.xlarge++;
      return acc;
    }, { small: 0, medium: 0, large: 0, xlarge: 0 });

    // ✅ GOOD: 최근 활동 분석
    const now = Date.now();
    const recentActivity = {
      last7Days: videos.filter(video => 
        video.createdAt > new Date(now - 7 * 24 * 60 * 60 * 1000)
      ).length,
      last30Days: videos.filter(video => 
        video.createdAt > new Date(now - 30 * 24 * 60 * 60 * 1000)
      ).length,
      last90Days: videos.filter(video => 
        video.createdAt > new Date(now - 90 * 24 * 60 * 60 * 1000)
      ).length
    };

    // ✅ GOOD: FxTS를 올바르게 사용한 업로드 트렌드 분석
    const recentVideos = videos.filter(video => 
      video.createdAt > new Date(now - 30 * 24 * 60 * 60 * 1000)
    );

    // FxTS Best Practice: toAsync + await 사용
    const transformedVideos = await pipe(
      recentVideos,
      toAsync,  // 🔑 AsyncIterable로 변환
      map(video => {
        const date = new Date(video.createdAt);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { date: dateStr, size: video.size };
      }),
      toArray  // Promise<T[]> 반환
    );

    // 이제 transformedVideos는 실제 배열이므로 안전하게 처리 가능
    const dailyStats = transformedVideos.reduce((acc, video) => {
      if (!acc[video.date]) {
        acc[video.date] = { uploads: 0, totalSizeMB: 0 };
      }
      acc[video.date].uploads++;
      acc[video.date].totalSizeMB += video.size / 1024 / 1024;
      return acc;
    }, {} as Record<string, { uploads: number; totalSizeMB: number }>);

    const uploadTrends = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        uploads: stats.uploads,
        totalSizeMB: Math.round(stats.totalSizeMB * 100) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalVideos,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      averageSizeMB: Math.round(averageSizeMB * 100) / 100,
      videosByMimeType,
      videosBySize,
      recentActivity,
      uploadTrends
    };
  }

  async getDetailedAnalytics() {
    const [userAnalytics, videoAnalytics] = await Promise.all([
      this.getUserAnalytics(),
      this.getVideoAnalytics()
    ]);

    // ✅ GOOD: 교차 분석 데이터
    const crossAnalysis = await this.getCrossAnalysis();

    return {
      users: userAnalytics,
      videos: videoAnalytics,
      cross: crossAnalysis,
      summary: {
        totalUsers: userAnalytics.totalUsers,
        totalVideos: videoAnalytics.totalVideos,
        averageVideosPerUser: userAnalytics.averageVideosPerUser,
        totalStorageMB: videoAnalytics.totalSizeMB,
        activeUserRatio: userAnalytics.activeUsers / userAnalytics.totalUsers,
        recentActivityScore: videoAnalytics.recentActivity.last7Days / videoAnalytics.totalVideos
      }
    };
  }

  private async getCrossAnalysis() {
    const data = await this.prisma.user.findMany({
      include: {
        Video: {
          select: {
            idx: true,
            size: true,
            mimeType: true,
            createdAt: true,
          }
        }
      }
    });

    // ✅ GOOD: FxTS를 올바르게 사용한 사용자별 활동 패턴 분석
    // FxTS Best Practice: toAsync + await 사용
    const userProfiles = await pipe(
      data,
      toAsync,  // 🔑 AsyncIterable로 변환
      map(user => ({
        userId: user.idx,
        userName: user.name || user.email,
        isActive: user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        videoCount: user.Video.length,
        totalSizeMB: Math.round(user.Video.reduce((sum, video) => sum + video.size, 0) / 1024 / 1024 * 100) / 100,
        avgVideoSizeMB: user.Video.length > 0 
          ? Math.round(user.Video.reduce((sum, video) => sum + video.size, 0) / 1024 / 1024 / user.Video.length * 100) / 100
          : 0,
        hasRecentUploads: user.Video.some(video => 
          video.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ),
        preferredMimeType: user.Video.length > 0 
          ? user.Video.reduce((acc, video) => {
              acc[video.mimeType] = (acc[video.mimeType] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          : {}
      })),
      toArray  // Promise<T[]> 반환
    );

    // 이제 userProfiles는 실제 배열이므로 안전하게 filter 사용 가능
    const activeUsers = userProfiles.filter(user => user.isActive);
    const inactiveUsers = userProfiles.filter(user => !user.isActive);

    return {
      userActivityPatterns: {
        activeUsers,
        inactiveUsers
      },
      insights: {
        heavyUploaders: activeUsers.filter(user => user.videoCount > 5).length,
        storageHogs: activeUsers.filter(user => user.totalSizeMB > 100).length,
        recentlyActiveUsers: activeUsers.filter(user => user.hasRecentUploads).length
      }
    };
  }
} 