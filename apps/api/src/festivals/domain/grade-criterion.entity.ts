import { randomUUID } from 'crypto';
import { FestivalValidationError } from './festival-validation.error';

export interface GradeCriterionProps {
  id: string;
  tenantId: string;
  stageId: string;
  name: string;
  weight: number;
  createdAt: Date;
}

export interface CreateGradeCriterionInput {
  tenantId: string;
  stageId: string;
  name: string;
  weight: number;
}

export class GradeCriterion {
  private constructor(private readonly props: GradeCriterionProps) {}

  static create(input: CreateGradeCriterionInput): GradeCriterion {
    if (input.name.trim().length === 0) {
      throw new FestivalValidationError('name must not be empty');
    }
    if (input.weight <= 0) {
      throw new FestivalValidationError('weight must be greater than zero');
    }

    return new GradeCriterion({
      id: randomUUID(),
      tenantId: input.tenantId,
      stageId: input.stageId,
      name: input.name,
      weight: input.weight,
      createdAt: new Date(),
    });
  }

  static restore(props: GradeCriterionProps): GradeCriterion {
    return new GradeCriterion(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get stageId(): string {
    return this.props.stageId;
  }
  get name(): string {
    return this.props.name;
  }
  get weight(): number {
    return this.props.weight;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
