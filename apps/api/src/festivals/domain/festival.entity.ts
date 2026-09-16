import { randomUUID } from 'crypto';
import { InvalidFestivalStateError } from './invalid-festival-state.error';

export type FestivalStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

export interface FestivalProps {
  id: string;
  tenantId: string;
  number: number;
  year: number;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin: Date | null;
  votingEnd: Date | null;
  status: FestivalStatus;
  inscriptionFee: number;
  regulationUrl: string | null;
  allowedStates: BrazilianState[];
  createdAt: Date;
  updatedAt: Date;
}

interface FestivalDetailsInput {
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin?: Date | null;
  votingEnd?: Date | null;
  inscriptionFee: number;
  regulationUrl?: string | null;
  allowedStates?: BrazilianState[];
}

export interface CreateFestivalInput extends FestivalDetailsInput {
  tenantId: string;
  number: number;
  year: number;
}

export type UpdateFestivalDetailsInput = FestivalDetailsInput;

function validateDetails(input: FestivalDetailsInput): void {
  if (input.name.trim().length === 0) {
    throw new Error('name must not be empty');
  }
  if (input.registrationBegin.getTime() >= input.registrationEnd.getTime()) {
    throw new Error('registrationBegin must be before registrationEnd');
  }
  const hasVotingBegin = input.votingBegin != null;
  const hasVotingEnd = input.votingEnd != null;
  if (hasVotingBegin !== hasVotingEnd) {
    throw new Error(
      'votingBegin and votingEnd must both be set or both be null',
    );
  }
  if (
    hasVotingBegin &&
    hasVotingEnd &&
    input.votingBegin!.getTime() >= input.votingEnd!.getTime()
  ) {
    throw new Error('votingBegin must be before votingEnd');
  }
  if (input.inscriptionFee < 0) {
    throw new Error('inscriptionFee must not be negative');
  }
  for (const state of input.allowedStates ?? []) {
    if (!(BRAZILIAN_STATES as readonly string[]).includes(state)) {
      throw new Error(`invalid state: ${state}`);
    }
  }
}

export class Festival {
  private constructor(private readonly props: FestivalProps) {}

  static create(input: CreateFestivalInput): Festival {
    if (!Number.isInteger(input.number) || input.number <= 0) {
      throw new Error('number must be a positive integer');
    }
    if (
      !Number.isInteger(input.year) ||
      input.year < 1900 ||
      input.year > 2200
    ) {
      throw new Error('year must be a valid 4-digit year');
    }
    validateDetails(input);

    const now = new Date();
    return new Festival({
      id: randomUUID(),
      tenantId: input.tenantId,
      number: input.number,
      year: input.year,
      name: input.name,
      registrationBegin: input.registrationBegin,
      registrationEnd: input.registrationEnd,
      votingBegin: input.votingBegin ?? null,
      votingEnd: input.votingEnd ?? null,
      status: 'DRAFT',
      inscriptionFee: input.inscriptionFee,
      regulationUrl: input.regulationUrl ?? null,
      allowedStates: input.allowedStates ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: FestivalProps): Festival {
    return new Festival(props);
  }

  updateDetails(input: UpdateFestivalDetailsInput): Festival {
    validateDetails(input);
    return new Festival({
      ...this.props,
      name: input.name,
      registrationBegin: input.registrationBegin,
      registrationEnd: input.registrationEnd,
      votingBegin: input.votingBegin ?? null,
      votingEnd: input.votingEnd ?? null,
      inscriptionFee: input.inscriptionFee,
      regulationUrl: input.regulationUrl ?? null,
      allowedStates: input.allowedStates ?? [],
      updatedAt: new Date(),
    });
  }

  publish(): Festival {
    if (this.props.status !== 'DRAFT') {
      throw new InvalidFestivalStateError(
        'only a DRAFT festival can be published',
      );
    }
    return new Festival({
      ...this.props,
      status: 'OPEN',
      updatedAt: new Date(),
    });
  }

  close(): Festival {
    if (this.props.status !== 'OPEN') {
      throw new InvalidFestivalStateError(
        'only an OPEN festival can be closed',
      );
    }
    return new Festival({
      ...this.props,
      status: 'CLOSED',
      updatedAt: new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get number(): number {
    return this.props.number;
  }
  get year(): number {
    return this.props.year;
  }
  get name(): string {
    return this.props.name;
  }
  get registrationBegin(): Date {
    return this.props.registrationBegin;
  }
  get registrationEnd(): Date {
    return this.props.registrationEnd;
  }
  get votingBegin(): Date | null {
    return this.props.votingBegin;
  }
  get votingEnd(): Date | null {
    return this.props.votingEnd;
  }
  get status(): FestivalStatus {
    return this.props.status;
  }
  get inscriptionFee(): number {
    return this.props.inscriptionFee;
  }
  get regulationUrl(): string | null {
    return this.props.regulationUrl;
  }
  get allowedStates(): BrazilianState[] {
    return this.props.allowedStates;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
