import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { Registration } from '../domain/registration.entity';
import type { RegistrationProps } from '../domain/registration.entity';
import type { RegistrationsRepositoryPort } from '../application/ports/registrations-repository.port';

interface RegistrationRow {
  id: string;
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer: string | null;
  lyricsComposer: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaRegistrationsRepository
  extends TenantScopedRepository
  implements RegistrationsRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(registration: Registration): Promise<void> {
    await this.prisma.registration.upsert({
      where: { id: registration.id },
      create: {
        id: registration.id,
        tenantId: registration.tenantId,
        festivalId: registration.festivalId,
        participantName: registration.participantName,
        participantEmail: registration.participantEmail,
        participantCpf: registration.participantCpf,
        songName: registration.songName,
        performers: registration.performers,
        musicComposer: registration.musicComposer,
        lyricsComposer: registration.lyricsComposer,
        videoUrl: registration.videoUrl,
        createdAt: registration.createdAt,
      },
      update: {
        participantName: registration.participantName,
        participantEmail: registration.participantEmail,
        participantCpf: registration.participantCpf,
        songName: registration.songName,
        performers: registration.performers,
        musicComposer: registration.musicComposer,
        lyricsComposer: registration.lyricsComposer,
        videoUrl: registration.videoUrl,
      },
    });
  }

  async findAllByTenant(tenantId: string): Promise<Registration[]> {
    const rows = await this.prisma.registration.findMany({
      where: this.tenantScoped(tenantId),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findAllByFestival(tenantId: string, festivalId: string): Promise<Registration[]> {
    const rows = await this.prisma.registration.findMany({
      where: this.tenantScoped(tenantId, { festivalId }),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: RegistrationRow): Registration {
    const props: RegistrationProps = {
      id: row.id,
      tenantId: row.tenantId,
      festivalId: row.festivalId,
      participantName: row.participantName,
      participantEmail: row.participantEmail,
      participantCpf: row.participantCpf,
      songName: row.songName,
      performers: row.performers,
      musicComposer: row.musicComposer,
      lyricsComposer: row.lyricsComposer,
      videoUrl: row.videoUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Registration.restore(props);
  }
}
