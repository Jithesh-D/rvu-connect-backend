const express = require("express");
const {
  addContribution,
  getContributions,
  updateContribution,
  deleteContribution,
  expressInterest,
  getInterests,
} = require("../controllers/contributionController");
const jwtAuthMiddleware = require("../Middleware/jwtAuth");

const router = express.Router();

router.post("/", addContribution);
router.get("/", getContributions);
router.put("/:id", updateContribution);
router.delete("/:id", deleteContribution);
router.post("/:id/interest", jwtAuthMiddleware, expressInterest);
router.get("/interests", jwtAuthMiddleware, getInterests);

module.exports = router;
