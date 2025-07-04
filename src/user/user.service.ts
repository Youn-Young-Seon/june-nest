import { Injectable, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/common/prisma.service';
import { pipe, filter, map, sortBy, take } from '@fxts/core';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {

  constructor(
    private prisma: PrismaService
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        name: createUserDto.name,
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        Video: {
          select: {
            idx: true,
            title: true,
            createdAt: true,
          }
        }
      }
    });

    return pipe(
      users,
      map(user => {
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          displayName: userWithoutPassword.name || userWithoutPassword.email,
          videoCount: userWithoutPassword.Video.length,
          isActive: userWithoutPassword.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          videos: userWithoutPassword.Video
        };
      }),
      sortBy(user => user.createdAt),
      sortBy(user => user.isActive ? 0 : 1)
    );
  }

  async findActiveUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        Video: {
          select: {
            idx: true,
            title: true,
            createdAt: true,
          }
        }
      }
    });

    return pipe(
      users,
      filter(user => user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      map(user => {
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          displayName: userWithoutPassword.name || userWithoutPassword.email,
          videoCount: userWithoutPassword.Video.length,
          isActive: true,
          videos: userWithoutPassword.Video
        };
      }),
      sortBy(user => user.createdAt),
      take(10)
    );
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { idx: id },
      include: {
        Video: {
          select: {
            idx: true,
            title: true,
            description: true,
            createdAt: true,
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      displayName: userWithoutPassword.name || userWithoutPassword.email,
      videoCount: userWithoutPassword.Video.length,
      isActive: userWithoutPassword.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      videos: userWithoutPassword.Video
    };
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
