import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';

const DEFAULT_USERS = [
  {
    email: 'admin@localhost',
    password: 'admin123',
    displayName: 'Portal Administrator',
    role: 'admin',
    language: 'de',
  },
  {
    email: 'user@localhost',
    password: 'user123',
    displayName: 'Demo Benutzer',
    role: 'user',
    language: 'de',
  },
];

export async function bootstrapDefaultUsers() {
  for (const seed of DEFAULT_USERS) {
    const existing = await User.findOne({ where: { email: seed.email } });
    if (existing) continue;

    const passwordHash = await bcrypt.hash(seed.password, 10);
    await User.create({
      email: seed.email,
      passwordHash,
      displayName: seed.displayName,
      role: seed.role,
      language: seed.language,
      emailVerified: true,
    });

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'bootstrap_user_created',
        email: seed.email,
        role: seed.role,
      })
    );
  }
}
