import { Router } from "express";
import { body } from "express-validator";
import { register, login, getMe, getAllUsers } from "../controllers/auth.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 80 })
    .withMessage("Name must be 80 characters or fewer"),
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password")
    // max 72: bcrypt silently ignores everything past 72 bytes, so a longer
    // password would give a false sense of security.
    .isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

router.post("/register", authLimiter, registerValidation, register);
router.post("/login", authLimiter, loginValidation, login);
router.get("/me", protect, getMe);

// Middleware runs left to right: protect first (must be logged in at all),
// THEN authorize("admin") (must specifically be an admin). If either fails,
// getAllUsers never runs.
router.get("/users", protect, authorize("admin"), getAllUsers);

export default router;