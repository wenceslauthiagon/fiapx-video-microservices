import { PrismaService } from '../database/prisma.service';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<User> {
    const created = await this.prisma.user.create({
      data: { id: user.id, email: user.email, password: user.password, name: user.name },
    });
    return new User(created.id, created.email, created.password, created.name);
  }

  async findById(id: string): Promise<User | null> {
    const found = await this.prisma.user.findUnique({ where: { id } });
    return found ? new User(found.id, found.email, found.password, found.name) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const found = await this.prisma.user.findUnique({ where: { email } });
    return found ? new User(found.id, found.email, found.password, found.name) : null;
  }
}
