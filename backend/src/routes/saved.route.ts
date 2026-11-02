import { Router } from "express";
import { listSaved, saveResource, unsaveResource } from "../controllers/saved.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Every saved-resource route is personal, so all of them require login.
router.use(protect);

router.get("/", listSaved);
router.post("/:resourceId", saveResource);
router.delete("/:resourceId", unsaveResource);

export default router;