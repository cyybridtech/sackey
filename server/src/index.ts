import app from './app';
import { createServer } from 'http';
import { initSocket } from './services/socket.service';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
