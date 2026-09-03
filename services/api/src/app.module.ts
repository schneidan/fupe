import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { GraphModule } from './graph/graph.module';
import { LookupModule } from './lookup/lookup.module';
import { AuthModule } from './auth/auth.module';
import { EditsModule } from './edits/edits.module';
import { EntitiesModule } from './entities/entities.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { BillingModule } from './billing/billing.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
    }),
    DatabaseModule,
    AuthModule,
    GraphModule,
    LookupModule,
    EditsModule,
    EntitiesModule,
    ApiKeysModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
