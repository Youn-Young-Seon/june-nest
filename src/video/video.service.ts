import { Injectable, Logger } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { stat } from 'fs/promises';
import { PrismaService } from 'src/common/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class VideoService {

  private readonly logger = new Logger(VideoService.name);

  constructor(private prisma: PrismaService) {}

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

  findOne(id: number) {
    return `This action returns a #${id} video`;
  }

  async getVideoStat(path: string) {
    return stat(path); // 파일의 Stat 객체 반환 (size, mtime 등 포함)
  }
}
