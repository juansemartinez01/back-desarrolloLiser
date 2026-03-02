import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from './naming.strategy';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        ({
          type: 'postgres',
          url: cfg.get<string>('DATABASE_URL'),
          ssl: cfg.get('DB_SSL') ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: true, // usar migraciones SIEMPRE
          namingStrategy: new SnakeNamingStrategy(),
          // pool tuning
          extra: {
            max: 20,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 10000,
          },
        }) as DataSourceOptions,
    }),
  ],
  exports: [],
})
export class DatabaseModule {}
