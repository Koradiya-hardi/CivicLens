import { Router } from "express";
import {
  askQuestion,
  askQuestionStream,
  listConversations,
  getConversation,
} from "../controllers/chat.controller";
import { protect } from "../middleware/auth.middleware";
import { chatLimiter } from "../middleware/rateLimiter";

const router = Router();

// protect only - no authorize("admin") here. This is the core feature
// every logged-in user gets, unlike resource management which is
// admin-only.
router.post("/ask", protect, chatLimiter, askQuestion);

// Events so the answer appears progressively instead of all at once.
router.post("/ask/stream", protect, chatLimiter, askQuestionStream);

// WEEK 3: conversation history endpoints
router.get("/conversations", protect, listConversations);
router.get("/conversations/:id", protect, getConversation);

export default router;