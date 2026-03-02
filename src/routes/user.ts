import express from "express";
import { isAuth } from "../middleware/auth.js";
import {
  getUserProfile,
  myProfile,
  updateUserProfile,
  updateUserProfilePic,
  updateUserResume,
} from "../controllers/user.js";
import uploadFile from "../middleware/multer.js";
const router = express.Router();

router.get("/myProfile", isAuth, myProfile);
router.get("/userProfile/:user_id", isAuth, getUserProfile);
router.put("/updateProfile", isAuth, updateUserProfile);
router.put("/updateProfilePic", isAuth, uploadFile, updateUserProfilePic);
router.put("/updateResume", isAuth, uploadFile, updateUserResume);

export default router;
