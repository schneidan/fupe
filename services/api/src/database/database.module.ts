import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DATABASE_POOL } from './database.constants';
import { GraphService } from './graph.service';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({
          connectionString:
            config.get<string>('DATABASE_URL') ??
            'postgresql://fupe:fupe_dev@localhost:5433/fupe',
        });

        return pool;
      },
    },
    GraphService,
  ],
  exports: [DATABASE_POOL, GraphService],
})
export class DatabaseModule {}
