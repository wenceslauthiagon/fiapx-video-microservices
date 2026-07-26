import { isEmail } from 'class-validator';

export class User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(id: string, email: string, password: string, name: string) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.name = name;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  isValidEmail(): boolean {
    return isEmail(this.email.trim());
  }
}
