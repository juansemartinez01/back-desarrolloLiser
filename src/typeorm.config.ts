import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './database/naming.strategy';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL, // 👈 usamos la URL completa
  ssl:
    (process.env.DB_SSL || 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,
  entities: ['src/**/*.entity.{ts,js}'],
  migrations: ['migrations/*.{ts,js}'],
  namingStrategy: new SnakeNamingStrategy(),
});
