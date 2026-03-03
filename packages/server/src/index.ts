import { createServer } from 'node:http';
import { app } from './app.js';
import { initSocketIO } from './socket/index.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[SERVER] Finlay Games server running on port ${PORT}`);
});
