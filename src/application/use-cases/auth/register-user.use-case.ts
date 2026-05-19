import { User } from '../../../domain/entities/user.entity';
import { IUserRepository } from '../../../domain/repositories';

export class RegisterUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(email: string, password: string, name: string, hashPassword: (pwd: string) => Promise<string>): Promise<User> {
    const exists = await this.userRepository.findByEmail(email);
    if (exists) {
      throw new Error('Email already registered');
    }

    const user = new User(`usr_${Date.now()}`, email, password, name);
    if (!user.isValidEmail()) {
      throw new Error('Invalid email format');
    }

    user.password = await hashPassword(password);
    return this.userRepository.create(user);
  }
}
