import jwt from 'jsonwebtoken';
import { config } from '../config/env.config.js';


export const generateToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: '48h',
  });
};
