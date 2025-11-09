const jwt = require("jsonwebtoken");
const User = require("../Model/userModel");

const jwtAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = { _id: user._id, id: user._id, email: user.email, username: user.username };
    next();
  } catch (error) {
    console.error("JWT Auth error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = jwtAuthMiddleware;