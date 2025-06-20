import express from 'express';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.route.js';
import fileRoutes from './routes/file.route.js';
import fsRoutes from './routes/fs.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';


const app = express();

app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/fs', fsRoutes);

app.use(errorHandler);

export default app;
