import { client } from '../lib/reauth-engine';

// Run database migrations
async function migrate() {
  console.log('Running database migrations...');

  try {
    // Get the latest schema version
    const version = await client.version();
    console.log(`Current database version: ${version}`);

    // Migrate to the latest version
    await client.migrate();
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
