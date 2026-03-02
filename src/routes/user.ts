import express from "express";
import { isAuth } from "../middleware/auth.js";
import { getUserProfile, myProfile } from "../controllers/user.js";
const router = express.Router();

router.get("/myProfile", isAuth, myProfile)
router.get("/userProfile/:user_id", isAuth, getUserProfile);

export default router;
