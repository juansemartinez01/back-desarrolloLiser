export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  http: { port: parseInt(process.env.PORT || '3000', 10) },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    ssl: (process.env.DB_SSL || 'false') === 'true',
    schema: process.env.DB_SCHEMA || 'public',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});
