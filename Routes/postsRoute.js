const express = require("express");
const postRouter = express.Router();
const postController = require("../controllers/postsController");
const upload = require("../Middleware/upload");
const jwtAuthMiddleware = require("../Middleware/jwtAuth");

// Create post with JWT auth
postRouter.post(
  "/",
  jwtAuthMiddleware,
  upload.single("image"),
  postController.createPost
);

// Like/unlike posts
postRouter.post("/:id/like", jwtAuthMiddleware, postController.likePost);
postRouter.delete("/:id/like", jwtAuthMiddleware, postController.unlikePost);

// Get posts (no auth needed)
postRouter.get("/", postController.getPosts);

// Delete/edit posts
postRouter.delete("/:id", jwtAuthMiddleware, postController.deletePost);
postRouter.patch(
  "/:id",
  jwtAuthMiddleware,
  upload.single("image"),
  postController.editPost
);

module.exports = postRouter;
