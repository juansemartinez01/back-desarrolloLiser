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
          host: cfg.get('db.host'),
          port: cfg.get('db.port'),
          database: cfg.get('db.name'),
          username: cfg.get('db.user'),
          password: cfg.get('db.pass'),
          schema: cfg.get('db.schema'),
          ssl: cfg.get('db.ssl') ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false, // usar migraciones SIEMPRE
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
