import express from "express";
import {protect} from "../middlewares/auth.middleware.js";
import {createFile, getFiles, updateFile, deleteFile} from "../controllers/file.controller.js";


const router = express.Router();

router.use(protect);

router.route("/").post(createFile).get(getFiles);

router.route("/:id").put(updateFile).delete(deleteFile);

export default router;
