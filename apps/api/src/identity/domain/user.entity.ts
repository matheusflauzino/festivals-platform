import { randomUUID } from 'crypto';

export interface UserProps {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  cpf: string;
  passwordHash: string;
  createdAt: Date;
}

export interface CreateUserInput {
  tenantId: string;
  name: string;
  email: string;
  cpf: string;
  passwordHash: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_PATTERN = /^\d{11}$/;

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(input: CreateUserInput): User {
    if (!EMAIL_PATTERN.test(input.email)) {
      throw new Error('invalid email');
    }
    if (!CPF_PATTERN.test(input.cpf)) {
      throw new Error('cpf must be 11 digits');
    }

    return new User({
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      cpf: input.cpf,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    });
  }

  static restore(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get cpf(): string {
    return this.props.cpf;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
