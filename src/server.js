import app from './app.js';
import connectDB from './config/db.js';
import { config } from './config/env.config.js';


const PORT = config.port;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
