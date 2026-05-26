import '@testing-library/jest-dom';

// Set test environment variables
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';
