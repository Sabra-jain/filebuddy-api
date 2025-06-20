import mongoose from "mongoose";
import { config } from '../config/env.config.js';


export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

export default connectDB;
