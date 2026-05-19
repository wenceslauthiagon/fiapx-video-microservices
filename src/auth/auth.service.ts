import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import { AuthenticateUserUseCase, RegisterUserUseCase } from '../application/use-cases';

@Injectable()
export class AuthService {
  private readonly userRepository: PrismaUserRepository;

  constructor(private readonly jwtService: JwtService, prisma: PrismaService) {
    this.userRepository = new PrismaUserRepository(prisma);
  }

  async register(email: string, password: string, name: string) {
    const useCase = new RegisterUserUseCase(this.userRepository);
    const user = await useCase.execute(email, password, name, (pwd) => bcrypt.hash(pwd, 10));
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name } };
  }

  async login(email: string, password: string) {
    const useCase = new AuthenticateUserUseCase(this.userRepository);
    const user = await useCase.execute(email, password, (plain, hashed) => bcrypt.compare(plain, hashed));
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name } };
  }
}
