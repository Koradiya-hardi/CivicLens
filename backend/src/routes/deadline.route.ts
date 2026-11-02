import { Router } from "express";
import { body } from "express-validator";
import {
  listDeadlines,
  createDeadline,
  toggleDeadline,
  deleteDeadline,
} from "../controllers/deadline.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

const deadlineValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 120 })
    .withMessage("Title cannot exceed 120 characters"),
  // "YYYY-MM-DD" from an <input type="date"> is valid ISO 8601.
  body("dueDate").isISO8601().withMessage("Due date must be a valid date (YYYY-MM-DD)"),
  body("note")
    .optional({ values: "falsy" })
    .isLength({ max: 500 })
    .withMessage("Note cannot exceed 500 characters"),
  body("resourceId")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("resourceId must be a valid id"),
];

router.get("/", listDeadlines);
router.post("/", deadlineValidation, createDeadline);
router.patch("/:id/toggle", toggleDeadline);
router.delete("/:id", deleteDeadline);

export default router;