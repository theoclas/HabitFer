import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { checkedDate } from './entry.shared';
import type { PhotoDto } from './nutrition.dto';

/** Hasta 4 MB por foto (el teléfono la achica antes a unos 300 KB). */
const MAX_BYTES = 4 * 1024 * 1024;

/** Que los bytes sean de verdad una imagen del tipo que dice (JPEG, PNG o WebP). */
export function looksLikeImage(data: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mime === 'image/png') return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  if (mime === 'image/webp') {
    const ascii = (from: number, to: number) => String.fromCharCode(...data.slice(from, to));
    return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  }
  return false;
}

/** «Foto ahora, anoto después»: la foto queda pendiente en la comida hasta que se complete o se borre. */
@Injectable()
export class MealPhotosService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: PhotoDto) {
    const date = checkedDate(dto.date);
    const data = Buffer.from(dto.image, 'base64');
    if (data.length === 0) throw new BadRequestException('La foto llegó vacía.');
    if (data.length > MAX_BYTES) throw new BadRequestException('La foto es muy grande (máximo 4 MB).');
    if (!looksLikeImage(data, dto.mime)) throw new BadRequestException('Eso no parece una foto.');
    const row = await this.prisma.mealPhoto.create({
      data: { userId, date, meal: dto.meal, mime: dto.mime, data, note: dto.note?.trim() || null },
      select: { id: true, meal: true, note: true, createdAt: true },
    });
    return { id: row.id, meal: row.meal, note: row.note, createdAt: row.createdAt.toISOString() };
  }

  async file(userId: string, id: string) {
    const photo = await this.prisma.mealPhoto.findFirst({ where: { id, userId }, select: { data: true, mime: true } });
    if (!photo) throw new NotFoundException('Esa foto no existe.');
    return photo;
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.mealPhoto.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Esa foto no existe.');
    return { ok: true };
  }
}
