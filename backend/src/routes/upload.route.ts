import { Router } from "express";
import { uploadFile } from "../controllers/upload.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { handleFileUpload } from "../middleware/upload.middleware";

const router = Router();

// Order matters: confirm logged in -> confirm admin -> THEN let multer
// touch the request body/disk. No point accepting a file upload from
// someone who isn't allowed to upload anything in the first place.
router.post("/", protect, authorize("admin"), handleFileUpload, uploadFile);

export default router;