import { IUserRepository } from '../../../domain/repositories';

export class AuthenticateUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(
    email: string,
    password: string,
    comparePassword: (plain: string, hashed: string) => Promise<boolean>,
  ) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    return user;
  }
}
