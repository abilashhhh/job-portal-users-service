import express from "express";
import { isAuth } from "../middleware/auth.js";
import { myProfile } from "../controllers/user.js";
const router = express.Router();

router.get("/myProfile", isAuth, myProfile)

export default router;
