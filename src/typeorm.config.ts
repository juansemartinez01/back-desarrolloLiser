import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './database/naming.strategy';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  schema: process.env.DB_SCHEMA || 'public',
  ssl:
    (process.env.DB_SSL || 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,
  entities: ['src/**/*.entity.{ts,js}'],
  migrations: ['migrations/*.{ts,js}'],
  namingStrategy: new SnakeNamingStrategy(),
});
