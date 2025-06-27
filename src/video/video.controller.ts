import { Body, Controller, Get, Logger, Param, Post, Res, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { VideoService } from './video.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { CreateVideoDto } from './dto/create-video.dto';
import { CurrentUser, Public } from 'src/auth/decorators';
import { User } from '@prisma/client';

@Controller('video')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'public', 'temp'),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) {
        return cb(null, false);
      }
      cb(null, true);
    },
    limits: { fileSize: 1024 * 1024 * 1000 },
  }))
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File, 
    @Body() createVideoDto: CreateVideoDto,
    @CurrentUser() user: User,
  ) {
    const video = await this.videoService.createVideo(
      {...file},
      createVideoDto,
      user,
    );
    
    await this.videoService.processVideo(video.idx, createVideoDto);

    return {
      idx: video.idx,
      title: video.title,
      filename: file.filename,
      path: file.path,
    }
  }

  @Get()
  @Public()
  async getVideoList() {
    return await this.videoService.getVideoList();
  }

  @Get('stream/:idx')
  @Public()
  async streamVideo(@Param('idx') idx: string, @Res() res: Response) {
    const findVideo = await this.videoService.findOne(+idx);
    this.videoService.streamingVideo(findVideo.filePath, res);
  }
}
