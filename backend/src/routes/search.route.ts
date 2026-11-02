import { Router } from "express";
import { search, searchResources } from "../controllers/search.controller";

const router = Router();

router.get("/", search);
router.get("/resources", searchResources);

export default router;