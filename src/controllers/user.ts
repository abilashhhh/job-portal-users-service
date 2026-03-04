import axios from "axios";
import { AuthenticatedRequest } from "../middleware/auth.js";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";

export const myProfile = TryCatch(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    res.status(200).json({ user });
  },
);

export const getUserProfile = TryCatch(async (req, res, next) => {
  const { user_id } = req.params;

  const users = await sql`
          SELECT u.user_id,
                 u.email,
                 u.name,
                 u.phone_number,
                 u.role,
                 u.bio,
                 u.profile_pic_public_id,
                 u.profile_pic,
                 u.resume,
                 u.resume_public_id,
                 u.subscription,
                 ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) AS skills
          FROM users u
          LEFT JOIN user_skills us ON u.user_id = us.user_id
          LEFT JOIN skills s ON us.skill_id = s.skill_id
          WHERE u.user_id = ${user_id}
          GROUP BY u.user_id;
        `;

  if (users.length === 0) {
    throw new ErrorHandler(404, "User not found");
  }
  const user = users[0];
  user.skills = user.skills || [];
  res.json(user);
});

export const updateUserProfile = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      throw new ErrorHandler(401, "Authentication Required");
    }
    const { name, phone_number, bio } = req.body;

    const newName = name || user.name;
    const newPhoneNum = phone_number || user.phone_number;
    const newBio = bio || user.bio;

    const [updatedUser] = await sql`
    UPDATE users SET name = ${newName}, phone_number = ${newPhoneNum}, bio = ${newBio} 
    WHERE user_id = ${user.user_id}
    RETURNING user_id, email, name, phone_number, bio
    `;

    res.json({ message: "Profile updated successfully", updatedUser });
  },
);

export const updateUserProfilePic = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) throw new ErrorHandler(401, "Authentication Required");
    const file = req.file;
    if (!file) throw new ErrorHandler(400, "No image file provided");

    const oldProfilePublicId = user.profile_pic_public_id;
    const fileBuffer = getBuffer(file);
    if (!fileBuffer || !fileBuffer.content)
      throw new ErrorHandler(500, "Failed to generate buffer");

    const { data: uploadResult } = await axios.post<{
      url: string;
      public_id: string;
    }>(`${process.env.UPLOAD_SERVICE_URL}/api/utils/upload`, {
      buffer: fileBuffer.content,
      public_id: oldProfilePublicId,
    });

    if (
      !uploadResult ||
      typeof uploadResult.url !== "string" ||
      typeof uploadResult.public_id !== "string"
    ) {
      throw new ErrorHandler(500, "Invalid upload response");
    }

    const [updatedUser] = await sql`
    UPDATE users SET profile_pic = ${uploadResult.url} , profile_pic_public_id = ${uploadResult.public_id}
    WHERE user_id = ${user.user_id}
    RETURNING user_id, name, profile_pic;`;

    res.json({ message: "Profile picture updated successfully", updatedUser });
  },
);

export const updateUserResume = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) throw new ErrorHandler(401, "Authentication Required");
    const file = req.file;
    if (!file) throw new ErrorHandler(400, "No pdf file provided");

    const oldResumePublicId = user.resume_public_id;
    const fileBuffer = getBuffer(file);
    if (!fileBuffer || !fileBuffer.content)
      throw new ErrorHandler(500, "Failed to generate buffer");

    const { data: uploadResult } = await axios.post<{
      url: string;
      public_id: string;
    }>(`${process.env.UPLOAD_SERVICE_URL}/api/utils/upload`, {
      buffer: fileBuffer.content,
      public_id: oldResumePublicId,
    });

    if (
      !uploadResult ||
      typeof uploadResult.url !== "string" ||
      typeof uploadResult.public_id !== "string"
    ) {
      throw new ErrorHandler(500, "Invalid upload response");
    }

    const [updatedUser] = await sql`
    UPDATE users SET resume = ${uploadResult.url} , resume_public_id = ${uploadResult.public_id}
    WHERE user_id = ${user.user_id}
    RETURNING user_id, name, resume;`;

    res.json({ message: "Resume updated successfully", updatedUser });
  },
);

export const addSkillToUser = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) throw new ErrorHandler(401, "Authentication Required");
    const userId = user.user_id;
    const { skillName } = req.body;

    if (!skillName || skillName.trim() === "") {
      throw new ErrorHandler(400, "Please provide a skill name");
    }

    let wasSkillAdded = false;
    try {
      await sql`BEGIN`;
      const users =
        await sql`SELECT user_id from users WHERE user_id = ${userId}`;
      if (users.length === 0) {
        throw new ErrorHandler(404, "User not found");
      }

      const [skill] =
        await sql`INSERT INTO skills (name) VALUES (${skillName.trim()})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING skill_id`;

      const skill_id = skill.skill_id;
      const insertionResult =
        await sql`INSERT INTO user_skills (user_id, skill_id) VALUES (${userId}, ${skill_id})
          ON CONFLICT (user_id, skill_id) DO NOTHING
          RETURNING user_id`;

      if (insertionResult.length > 0) {
        wasSkillAdded = true;
      }
      await sql`COMMIT`;
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }

    if (!wasSkillAdded) {
      return res
        .status(200)
        .json({ message: "User already possess this skill" });
    }

    res.json({ message: `Skill ${skillName} is added successfully` });
  },
);

export const deleteSkillFromUser = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) throw new ErrorHandler(401, "Authentication Required");
    const { skillName } = req.body;

    if (!skillName || skillName.trim() === "") {
      throw new ErrorHandler(400, "Please provide a skill name");
    }

    const result =
      await sql`DELETE FROM user_skills WHERE user_id = ${user.user_id} 
        AND skill_id = (SELECT skill_id FROM skills WHERE name = ${skillName.trim()})
        RETURNING user_id;`;

    if (result.length === 0) {
      throw new ErrorHandler(404, `Skills ${skillName} was not found`);
    }

    res.json({
      message: `Skill ${skillName.trim()} was deleted successfully`,
    });
  },
);

export const applyForJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) throw new ErrorHandler(401, "Authentication required");
  if (user.role !== "jobseeker")
    throw new ErrorHandler(403, "Forbidden to do this request");
  const applicant_id = user.user_id;

  const resume = user.resume;
  if (!resume)
    throw new ErrorHandler(
      400,
      "Resume is required in the profile to apply for a job",
    );

  const {job_id} = req.body;
  if (!job_id)
    throw new ErrorHandler(
      400,
      "Job id is required in the profile to apply for a job",
    );

  const [job] = await sql`SELECT is_active FROM jobs WHERE job_id = ${job_id}`;
  if (!job) throw new ErrorHandler(404, "No jobs found with this id");
  if (!job.is_active) throw new ErrorHandler(400, "Jobs is not active");

  const now = Date.now();
  const subTime = req.user?.subscription
    ? new Date(req.user?.subscription).getTime()
    : 0;

  const isSubscribed = subTime > now;

  let newApplication;
  try {
    [newApplication] =
      await sql`INSERT INTO applications(job_id, applicant_id, applicant_email, resume, subscribed)
    VALUES (${job_id}, ${applicant_id}, ${user?.email}, ${resume}, ${isSubscribed})`;
  } catch (error: any) {
    if (error.code === "23505") {
      throw new ErrorHandler(409, "You have already applied for this job");
    }
    throw error;
  }

  res.json({
    message: "Applied for the job successfully",
    application: newApplication,
  });
});

export const getAllAplications = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const applications = await sql`
      SELECT a.*, 
             j.title AS job_title, 
             j.salary AS job_salary, 
             j.location AS job_location
      FROM applications a
      JOIN jobs j 
      ON a.job_id = j.job_id
      WHERE a.applicant_id = ${req.user?.user_id}
    `;
    res.json(applications);
  },
);
