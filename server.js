import { createServer } from './src/server.js';

const port = process.env.PORT ?? 3000;
const server = createServer();

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Copilot API Showcase Portal running on http://localhost:${port}`);
});
