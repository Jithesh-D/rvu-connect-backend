const bcrypt = require("bcryptjs");
const User = require("../Model/userModel");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");

// Multer setup for profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Environment-aware Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ALLOWED_DOMAIN = "@rvu.edu.in";
const NODE_ENV = process.env.NODE_ENV || "development";

// Frontend redirect URLs based on environment
const FRONTEND_URLS = {
  development: "http://localhost:5173",
  production: "https://rvu-connects.vercel.app"
};

if (!GOOGLE_CLIENT_ID) {
  console.warn("⚠️  GOOGLE_CLIENT_ID not set in environment variables");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Set session after signup
    req.session.user = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
    };

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating user" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "7d" }
    );

    console.log("🔐 Login successful for:", email, "Session ID:", req.sessionID);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    if (req.session.user && req.session.user.id) {
      const user = await User.findById(req.session.user.id).select("-password");

      if (user) {
        res.json({
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage || null,
            createdAt: user.createdAt,
          },
        });
      } else {
        // User not found in database
        req.session.destroy();
        res.status(404).json({ error: "User not found" });
      }
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  } catch (err) {
    console.error("Get current user error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Test version without auth middleware
exports.getCurrentUserTest = async (req, res) => {
  try {
    console.log("🧪 Profile test - Session info:", {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      userId: req.session?.user?.id,
      cookies: req.headers.cookie
    });

    if (req.session?.user?.id) {
      const user = await User.findById(req.session.user.id).select("-password");
      if (user) {
        res.json({
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage || null,
            createdAt: user.createdAt,
          },
        });
      } else {
        res.status(404).json({ error: "User not found in database" });
      }
    } else {
      res.status(401).json({ error: "No session or user data" });
    }
  } catch (err) {
    console.error("Profile test error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Handler to upload profile image (multipart/form-data)
exports.uploadProfileImage = [
  upload.single("profileImage"),
  async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.id) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const imagePath = `/uploads/${req.file.filename}`;

      const user = await User.findById(req.session.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.profileImage = imagePath;
      await user.save();

      // Also update session info so frontend /api/auth/check or session reads the new image
      req.session.user.profileImage = imagePath;

      res.json({ profileImage: imagePath });
    } catch (err) {
      console.error("Upload profile image error:", err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
];

// Handler to update username or profileImage via JSON
exports.updateProfile = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { username, profileImage } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (username && username.trim().length >= 3) {
      user.username = username.trim();
      req.session.user.username = user.username;
    }

    if (profileImage) {
      user.profileImage = profileImage;
      req.session.user.profileImage = profileImage;
    }

    await user.save();

    res.json({
      id: user._id,
      username: user.username,
      profileImage: user.profileImage || null,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// Check authentication status
exports.checkAuth = (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user,
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
};

// Logout user
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid"); // Clear the session cookie
    res.json({ message: "Logout successful" });
  });
};

// Google OAuth credential verification and login/signup
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "No credential provided" });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google OAuth not configured" });
    }

    // Verify ID token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name || payload?.given_name || "";
    const picture = payload?.picture;

    if (!email || !email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      return res.status(403).json({ 
        error: `Only ${ALLOWED_DOMAIN} accounts are allowed.`,
        redirectUrl: FRONTEND_URLS[NODE_ENV] + "/login?error=domain_not_allowed"
      });
    }

    // Create or find user record
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Create new user with Google data
      const randomPassword = Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({
        username: name || email.split("@")[0],
        email: email.toLowerCase(),
        password: hashedPassword,
        profileImage: picture || null,
        isGoogleUser: true
      });

      await user.save();
      console.log(`🆕 New Google user created: ${email}`);
    } else {
      // Update existing user info if needed
      let updated = false;
      if (!user.username && name) {
        user.username = name;
        updated = true;
      }
      if (!user.profileImage && picture) {
        user.profileImage = picture;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    // Create server-side session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      profileImage: user.profileImage
    };

    // Explicitly save session
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET || "your_jwt_secret",
        { expiresIn: "7d" }
      );
      
      console.log(`🔐 Google login successful: ${email} (${NODE_ENV})`);
      
      res.json({
        message: "Google login successful",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
        },
        redirectUrl: FRONTEND_URLS[NODE_ENV] + "/home"
      });
    });
  } catch (err) {
    console.error("❌ Google auth error:", err);
    res.status(500).json({ 
      error: "Google authentication failed",
      redirectUrl: FRONTEND_URLS[NODE_ENV] + "/login?error=auth_failed"
    });
  }
};
