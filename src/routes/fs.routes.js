import express from 'express';
import {protect} from '../middlewares/auth.middleware.js';
import {listDirectory, createItem, viewFileContent, deletePath, copyPath, movePath } from '../controllers/fs.controller.js';


const router = express.Router();

router.use(protect);

router.get('/', listDirectory);
router.post('/', createItem);
router.get('/content', viewFileContent);
router.delete('/', deletePath);
router.post('/copy', copyPath);
router.post('/move', movePath);

export default router;
