import express from 'express';
import { registerUser, loginUser } from '../controllers/auth.controller.js';


const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  console.log("Register route hit");
  await registerUser(req, res, next);
});


// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  console.log("login route hit");
  await loginUser(req, res, next);
});


export default router;
