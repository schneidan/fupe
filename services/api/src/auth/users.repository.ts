import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  trust_score: number;
  created_at: Date;
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM public.users WHERE email = $1',
      [email.toLowerCase()],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM public.users WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async create(
    email: string,
    passwordHash: string,
    trustScore = 0,
  ): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO public.users (email, password_hash, trust_score)
       VALUES ($1, $2, $3) RETURNING *`,
      [email.toLowerCase(), passwordHash, trustScore],
    );
    return rows[0];
  }
}
