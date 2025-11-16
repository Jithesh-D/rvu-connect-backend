const jwt = require("jsonwebtoken");

const POST_ADMIN_CREDENTIALS = {
  email: "RvuAdmin898@gmail.com",
  password: "RvuCreatePost_#*22",
  name: "Post Admin"
};

exports.loginPostAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (email !== POST_ADMIN_CREDENTIALS.email || password !== POST_ADMIN_CREDENTIALS.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { 
        email: POST_ADMIN_CREDENTIALS.email,
        name: POST_ADMIN_CREDENTIALS.name,
        role: "post_admin"
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        email: POST_ADMIN_CREDENTIALS.email,
        name: POST_ADMIN_CREDENTIALS.name,
        role: "post_admin"
      }
    });
  } catch (error) {
    console.error("Post admin login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};