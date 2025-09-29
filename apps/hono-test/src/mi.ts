import { InferFumaDB } from 'fumadb';
import { createCli } from 'fumadb/cli';

export function runMigrations(db: any) {
  const { main } = createCli({
    db,
    command: 'chat-lib',
    // you can import the version from your package's `package.json`
    version: '2.1.0',
  });

  return main();
}
