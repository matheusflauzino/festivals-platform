import { randomUUID } from 'crypto';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export interface TenantProps {
  id: string;
  name: string;
  document: string;
  slug: string;
  status: TenantStatus;
  createdAt: Date;
}

export interface CreateTenantInput {
  name: string;
  document: string;
  slug: string;
}

const DOCUMENT_PATTERN = /^[A-Za-z0-9]{14}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class Tenant {
  private constructor(private readonly props: TenantProps) {}

  static create(input: CreateTenantInput): Tenant {
    if (!DOCUMENT_PATTERN.test(input.document)) {
      throw new Error('document must be 14 alphanumeric characters');
    }
    if (!SLUG_PATTERN.test(input.slug)) {
      throw new Error('slug must be lowercase letters, numbers and hyphens only');
    }

    return new Tenant({
      id: randomUUID(),
      name: input.name,
      document: input.document.toUpperCase(),
      slug: input.slug,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
  }

  static restore(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get document(): string {
    return this.props.document;
  }

  get slug(): string {
    return this.props.slug;
  }

  get status(): TenantStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
