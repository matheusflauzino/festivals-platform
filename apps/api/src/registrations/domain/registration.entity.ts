import { randomUUID } from 'crypto';
import { RegistrationValidationError } from './registration-validation.error';

export interface RegistrationProps {
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

export interface CreateRegistrationInput {
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer?: string | null;
  lyricsComposer?: string | null;
  videoUrl?: string | null;
}

export class Registration {
  private constructor(private readonly props: RegistrationProps) {}

  static create(input: CreateRegistrationInput): Registration {
    if (input.participantName.trim().length === 0) {
      throw new RegistrationValidationError(
        'participantName must not be empty',
      );
    }
    if (!/^\d{11}$/.test(input.participantCpf)) {
      throw new RegistrationValidationError(
        'participantCpf must be exactly 11 digits',
      );
    }
    if (input.songName.trim().length === 0) {
      throw new RegistrationValidationError('songName must not be empty');
    }
    if (input.performers.trim().length === 0) {
      throw new RegistrationValidationError('performers must not be empty');
    }

    const now = new Date();
    return new Registration({
      id: randomUUID(),
      tenantId: input.tenantId,
      festivalId: input.festivalId,
      participantName: input.participantName,
      participantEmail: input.participantEmail,
      participantCpf: input.participantCpf,
      songName: input.songName,
      performers: input.performers,
      musicComposer: input.musicComposer ?? null,
      lyricsComposer: input.lyricsComposer ?? null,
      videoUrl: input.videoUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: RegistrationProps): Registration {
    return new Registration(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get festivalId(): string {
    return this.props.festivalId;
  }
  get participantName(): string {
    return this.props.participantName;
  }
  get participantEmail(): string {
    return this.props.participantEmail;
  }
  get participantCpf(): string {
    return this.props.participantCpf;
  }
  get songName(): string {
    return this.props.songName;
  }
  get performers(): string {
    return this.props.performers;
  }
  get musicComposer(): string | null {
    return this.props.musicComposer;
  }
  get lyricsComposer(): string | null {
    return this.props.lyricsComposer;
  }
  get videoUrl(): string | null {
    return this.props.videoUrl;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
