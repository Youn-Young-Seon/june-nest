import { Injectable } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { stat } from 'fs/promises';

@Injectable()
export class VideoService {
  async processVideo(createVideoDto: CreateVideoDto) {
    return 'This action adds a new video';
  }

  findOne(id: number) {
    return `This action returns a #${id} video`;
  }

  async getVideoStat(path: string) {
    return stat(path); // 파일의 Stat 객체 반환 (size, mtime 등 포함)
  }
}
