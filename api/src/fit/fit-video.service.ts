import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FitVideo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { VideoDto } from './fit.dto';
import { EXERCISE_BY_KEY, resolveReady } from './library';
import { oembed, parseYouTube } from './youtube';

export function videoView(v: FitVideo) {
  return {
    id: v.id,
    target: v.targetType as 'exercise' | 'routine',
    key: v.targetKey,
    videoId: v.videoId,
    start: v.start,
    title: v.title,
    channel: v.channel,
  };
}

/** Los videos de YouTube que la persona pega en sus ejercicios y rutinas (uno por cada uno). */
@Injectable()
export class FitVideoService {
  /** Cómo se le pregunta a YouTube (en las pruebas se cambia). */
  fetcher: typeof fetch = (input, init) => fetch(input, init);

  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.fitVideo.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return rows.map(videoView);
  }

  private async targetExists(userId: string, dto: VideoDto): Promise<boolean> {
    if (dto.target === 'exercise') return EXERCISE_BY_KEY.has(dto.key);
    if (resolveReady(dto.key)) return true;
    const own = await this.prisma.fitRoutine.findFirst({ where: { id: dto.key, userId, archived: false }, select: { id: true } });
    return !!own;
  }

  /** Pega (o cambia) el video de un ejercicio o una rutina. */
  async save(userId: string, dto: VideoDto) {
    if (!(await this.targetExists(userId, dto))) throw new NotFoundException(dto.target === 'exercise' ? 'Ese ejercicio no existe.' : 'Esa rutina ya no existe.');
    const parsed = parseYouTube(dto.url);
    if (!parsed) throw new BadRequestException('Ese link no es de un video de YouTube.');
    const info = await oembed(parsed.id, this.fetcher);
    if (!info.ok && info.reason === 'blocked') throw new BadRequestException('El dueño de ese video no deja verlo dentro de otras páginas. Busca otro.');
    if (!info.ok && info.reason === 'missing') throw new BadRequestException('Ese video no existe o es privado.');
    // Si YouTube no contesta, se guarda igual (sin título): el reproductor dirá si no se puede ver.
    const data = { videoId: parsed.id, start: parsed.start, title: info.ok ? info.title || null : null, channel: info.ok ? info.channel || null : null };
    const row = await this.prisma.fitVideo.upsert({
      where: { userId_targetType_targetKey: { userId, targetType: dto.target, targetKey: dto.key } },
      create: { userId, targetType: dto.target, targetKey: dto.key, ...data },
      update: data,
    });
    return videoView(row);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.fitVideo.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Ese video ya no está.');
    return { removed: count };
  }
}
