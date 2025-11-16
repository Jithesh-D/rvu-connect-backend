const express = require("express");
const postRouter = express.Router();
const postController = require("../controllers/postsController");
const upload = require("../Middleware/upload");
const postAuth = require("../Middleware/postAuth");

// Create post with post auth
postRouter.post(
  "/",
  postAuth,
  upload.single("image"),
  postController.createPost
);

// Like/unlike posts
postRouter.post("/:id/like", postAuth, postController.likePost);
postRouter.delete("/:id/like", postAuth, postController.unlikePost);

// Get posts (no auth needed)
postRouter.get("/", postController.getPosts);

// Delete/edit posts
postRouter.delete("/:id", postAuth, postController.deletePost);
postRouter.patch(
  "/:id",
  postAuth,
  upload.single("image"),
  postController.editPost
);

module.exports = postRouter;
