import { randomBytes, randomUUID } from 'crypto';

export type AdminRole = 'ORGANIZER' | 'JUDGE' | 'COMMITTEE';
export type AdminStatus = 'PENDING' | 'ACTIVE';

export interface AdminUserProps {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  passwordHash: string | null;
  inviteToken: string | null;
  createdAt: Date;
}

export interface InviteAdminUserInput {
  tenantId: string;
  name: string;
  email: string;
  role: AdminRole;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: AdminRole[] = ['ORGANIZER', 'JUDGE', 'COMMITTEE'];

export class AdminUser {
  private constructor(private readonly props: AdminUserProps) {}

  static invite(input: InviteAdminUserInput): AdminUser {
    if (!EMAIL_PATTERN.test(input.email)) {
      throw new Error('invalid email');
    }
    if (!VALID_ROLES.includes(input.role)) {
      throw new Error('invalid role');
    }

    return new AdminUser({
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      role: input.role,
      status: 'PENDING',
      passwordHash: null,
      inviteToken: randomBytes(32).toString('hex'),
      createdAt: new Date(),
    });
  }

  static restore(props: AdminUserProps): AdminUser {
    return new AdminUser(props);
  }

  activate(passwordHash: string): AdminUser {
    if (this.props.status !== 'PENDING') {
      throw new Error('admin already active');
    }
    return new AdminUser({
      ...this.props,
      status: 'ACTIVE',
      passwordHash,
      inviteToken: null,
    });
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

  get role(): AdminRole {
    return this.props.role;
  }

  get status(): AdminStatus {
    return this.props.status;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get inviteToken(): string | null {
    return this.props.inviteToken;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
