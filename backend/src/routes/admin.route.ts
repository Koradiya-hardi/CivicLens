import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getAnalytics } from "../controllers/admin.analytics.controller";
import { getSystemHealth, runOrphanCleanup } from "../controllers/admin.health.controller";
import { listUsers, updateUserRole, deleteUser } from "../controllers/admin.users.controller";
import {
  listAdminResources,
  setPublished,
  deleteAdminResource,
} from "../controllers/admin.resources.controller";

const router = Router();


router.use(protect, authorize("admin"));

router.get("/analytics", getAnalytics);
router.get("/health", getSystemHealth);
router.post("/maintenance/cleanup-orphans", runOrphanCleanup);

router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

router.get("/resources", listAdminResources);
router.patch("/resources/:id/publish", setPublished);
router.delete("/resources/:id", deleteAdminResource);

export default router;
