import { randomUUID } from 'crypto';
import { FestivalValidationError } from './festival-validation.error';

export interface StageProps {
  id: string;
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota: number | null;
  createdAt: Date;
}

export interface CreateStageInput {
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota?: number | null;
}

export class Stage {
  private constructor(private readonly props: StageProps) {}

  static create(input: CreateStageInput): Stage {
    if (input.name.trim().length === 0) {
      throw new FestivalValidationError('name must not be empty');
    }
    if (!Number.isInteger(input.order) || input.order < 1) {
      throw new FestivalValidationError('order must be a positive integer');
    }
    if (
      input.advancementQuota !== undefined &&
      input.advancementQuota !== null &&
      (!Number.isInteger(input.advancementQuota) || input.advancementQuota < 1)
    ) {
      throw new FestivalValidationError(
        'advancementQuota must be a positive integer when set',
      );
    }

    return new Stage({
      id: randomUUID(),
      tenantId: input.tenantId,
      festivalId: input.festivalId,
      name: input.name,
      order: input.order,
      advancementQuota: input.advancementQuota ?? null,
      createdAt: new Date(),
    });
  }

  static restore(props: StageProps): Stage {
    return new Stage(props);
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
  get name(): string {
    return this.props.name;
  }
  get order(): number {
    return this.props.order;
  }
  get advancementQuota(): number | null {
    return this.props.advancementQuota;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
