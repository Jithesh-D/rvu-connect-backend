const jwt = require("jsonwebtoken");

const postAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    
    if (decoded.role !== "post_admin") {
      return res.status(403).json({ error: "Access denied. Invalid role." });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Post auth middleware error:", error);
    res.status(401).json({ error: "Invalid token." });
  }
};

module.exports = postAuth;