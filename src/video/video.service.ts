import { Injectable, Logger } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { stat } from 'fs/promises';
import { PrismaService } from 'src/common/prisma.service';
import { User } from '@prisma/client';
import { createReadStream } from 'fs';
import { Response } from 'express';

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

    return videos;
  }

  async processVideo(fileIdx: number, createVideoDto: CreateVideoDto) {
    return 'This action adds a new video';
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
}
