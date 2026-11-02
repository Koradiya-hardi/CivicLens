import { Router } from "express";
import { body } from "express-validator";
import {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
} from "../controllers/resource.controller";
import { protect, authorize } from "../middleware/auth.middleware";

const router = Router();

const resourceValidation = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("category")
    .isIn([
      "Transportation",
      "Housing",
      "Student Services",
      "Financial Aid",
      "Healthcare",
      "Immigration",
      "Taxes",
      "Other",
    ])
    .withMessage("Invalid category"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("content").trim().notEmpty().withMessage("Content is required"),
  body("tags").optional().isArray().withMessage("Tags must be an array of strings"),
  body("sourceUrl").optional().isURL().withMessage("sourceUrl must be a valid URL"),
   body("fileUrl").optional().isString(),
  body("fileName").optional().isString(),
  body("fileType").optional().isString(),
  body("fileSize").optional().isNumeric(),
];

// ---- Public routes (no `protect` - anyone can read) ----
router.get("/", getResources);
router.get("/:id", getResourceById);

// ---- Admin-only routes ----
// Same stacking pattern as /api/auth/users: protect (logged in) then
// authorize("admin") (specifically an admin), THEN validation, THEN the
// actual controller. Order matters - no point validating a request body
// from someone who isn't even allowed to be here.
router.post("/", protect, authorize("admin"), resourceValidation, createResource);
router.put("/:id", protect, authorize("admin"), resourceValidation, updateResource);
router.delete("/:id", protect, authorize("admin"), deleteResource);

export default router;