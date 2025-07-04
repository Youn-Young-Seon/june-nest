import { Injectable, Logger } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { stat } from 'fs/promises';
import { PrismaService } from 'src/common/prisma.service';
import { User, Video } from '@prisma/client';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { Response } from 'express';
import { basename, dirname, join } from 'path';
import { pipe, filter, map, sortBy, take, groupBy, countBy, reduce, toArray } from '@fxts/core';
import ffmpegFluent from 'fluent-ffmpeg';

@Injectable()
export class VideoService {  
  private readonly logger = new Logger(VideoService.name);

  constructor(private prisma: PrismaService) { }

  async createVideo(file: Express.Multer.File, createVideoDto: CreateVideoDto, user: User) {
    return this.prisma.video.create({
      data: {
        ...createVideoDto,
        originalName: file.originalname,
        fileName: file.filename,
        filePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: { connect: { idx: user.idx } },
      }
    });
  }

  async getVideoList() {
    const videos = await this.prisma.video.findMany({
      select: {
        idx: true,
        title: true,
        description: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        size: true,
        thumbnailPath: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: {
            idx: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    this.logger.debug('Videos:', videos);

    return pipe(
      videos,
      map(video => ({
        ...video,
        displayTitle: video.title || video.fileName || 'Untitled',
        sizeInMB: Math.round(video.size / 1024 / 1024 * 100) / 100,
        hasThumbnail: !!video.thumbnailPath,
        uploaderName: video.uploadedBy.name || video.uploadedBy.email,
        ageInDays: Math.floor((Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        isRecent: video.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      })),
      sortBy(video => video.createdAt),
      sortBy(video => video.isRecent ? 0 : 1),
      toArray
    );
  }

  async getVideosByUser(userId: number) {
    const videos = await this.prisma.video.findMany({
      where: {
        uploadedById: userId
      },
      select: {
        idx: true,
        title: true,
        description: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        size: true,
        thumbnailPath: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: {
            idx: true,
            name: true,
            email: true,
          }
        }
      }
    });

    return pipe(
      videos,
      map(video => ({
        ...video,
        displayTitle: video.title || video.fileName || 'Untitled',
        sizeInMB: Math.round(video.size / 1024 / 1024 * 100) / 100,
        hasThumbnail: !!video.thumbnailPath,
        uploaderName: video.uploadedBy.name || video.uploadedBy.email,
        ageInDays: Math.floor((Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      })),
      sortBy(video => video.createdAt),
      toArray
    );
  }

  async getVideoStatistics() {
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

    const totalVideos = videos.length;
    const totalSizeInMB = videos.reduce((sum, video) => sum + video.size, 0) / 1024 / 1024;

    const videosByMimeType = pipe(
      videos,
      countBy(video => video.mimeType)
    );

    const videosByUploader = pipe(
      videos,
      groupBy(video => video.uploadedBy.name || video.uploadedBy.email),
      uploaderGroups => Object.entries(uploaderGroups).map(([uploader, videos]) => ({
        uploader,
        count: videos.length,
        totalSizeMB: Math.round(videos.reduce((sum, video) => sum + video.size, 0) / 1024 / 1024 * 100) / 100
      })),
      sortBy(stat => -stat.count),
      toArray
    );

    const recentVideos = pipe(
      videos,
      filter(video => video.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      toArray,
      videos => videos.length
    );

    return {
      totalVideos,
      totalSizeInMB: Math.round(totalSizeInMB * 100) / 100,
      videosByMimeType,
      videosByUploader,
      recentVideos
    };
  }

  async getRecentVideos(limit: number = 10) {
    const videos = await this.prisma.video.findMany({
      select: {
        idx: true,
        title: true,
        description: true,
        fileName: true,
        size: true,
        thumbnailPath: true,
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

    return pipe(
      videos,
      filter(video => video.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      map(video => ({
        ...video,
        displayTitle: video.title || video.fileName || 'Untitled',
        sizeInMB: Math.round(video.size / 1024 / 1024 * 100) / 100,
        uploaderName: video.uploadedBy.name || video.uploadedBy.email,
        ageInDays: Math.floor((Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      })),
      sortBy(video => video.createdAt),
      take(limit),
      toArray
    );
  }

  async processVideo(video: Video) {
    const thumbnailDir = join(process.cwd(), 'public', 'temp', 'thumbnails');
    if (!existsSync(thumbnailDir)) {
      mkdirSync(thumbnailDir, { recursive: true });
    }
  
    const thumbnailPath = join(thumbnailDir, `thumbnail_${video.idx}.jpg`);
    const videoPath = video.filePath;
    await this.generateThumbnail(videoPath, thumbnailPath);
  
    return await this.prisma.video.update({
      where: {
        idx: video.idx
      },
      data: {
        thumbnailPath
      }
    });
  }

  private async generateThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpegFluent(videoPath)
        .screenshots({
          timestamps: ['10%'],
          filename: basename(thumbnailPath),
          folder: dirname(thumbnailPath),
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  }

  async findOne(id: number) {
    return await this.prisma.video.findUnique({
      select: {
        idx: true,
        title: true,
        description: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        size: true,
        thumbnailPath: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: {
            idx: true,
            name: true,
            email: true,
          }
        }
      },
      where: {
        idx: id
      }
    });
  }

  async streamingVideo(path: string, res: Response<string, any>) {
    const stat = await this.getStat(path);

    const fileSize = stat.size;
    const range = res.req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = createReadStream(path, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });

      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });

      createReadStream(path).pipe(res);
    }
  }

  async getStat(videoPath: string) {
    return stat(videoPath);
  }

  async getThumbnailImage(idx: number) {
    const video = await this.prisma.video.findUnique({
      select: {
        idx: true,
        thumbnailPath: true
      },
      where: {
        idx: idx
      }
    });

    if (video && video.thumbnailPath !== null) {
      if (!existsSync(join(process.cwd(), 'public', 'temp', 'thumbnails', `thumbnail_${video.idx}.jpg`))) {
        return null;
      }
    }

    return video.thumbnailPath;
  }
}
