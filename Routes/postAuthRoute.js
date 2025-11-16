const express = require("express");
const router = express.Router();
const { loginPostAdmin } = require("../controllers/postAuthController");

router.post("/login", loginPostAdmin);

module.exports = router;