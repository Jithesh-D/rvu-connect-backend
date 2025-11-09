require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);

// ==================== ENVIRONMENT CONFIGURATION ====================

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 5000;

// Environment-aware URLs
const FRONTEND_URLS = {
  development: ["http://localhost:5173", "http://localhost:3000"],
  production: ["https://rvu-connects.vercel.app"]
};

const BACKEND_URLS = {
  development: "http://localhost:5000",
  production: "https://rvu-connect.onrender.com"
};

// Get allowed origins based on environment
const getAllowedOrigins = () => {
  const origins = [...FRONTEND_URLS[NODE_ENV]];
  // Add custom origins from env if specified
  if (process.env.CUSTOM_FRONTEND_URLS) {
    origins.push(...process.env.CUSTOM_FRONTEND_URLS.split(","));
  }
  return origins;
};

// Database and session configuration
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/social-media";
const SESSION_SECRET = process.env.SESSION_SECRET || "your-super-secret-key";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`🔗 Allowed Origins:`, getAllowedOrigins());
console.log(`🗄️  Database: ${MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local MongoDB'}`);

// ==================== MONGODB SESSION STORE ====================

const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
  connectionOptions: {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  },
});

store.on("error", (error) => {
  console.error("❌ Session store error:", error);
});

// ==================== MIDDLEWARE SETUP ====================

// CORS Configuration - Environment Aware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Create uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory");
}

// Static files with proper headers
app.use("/uploads", express.static(uploadsDir, {
  setHeaders: (res, path) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

// Session middleware - Environment Aware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // Allow session creation for cross-domain
  store: store,
  name: "connect.sid",
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: NODE_ENV === "production", // HTTPS only in production
    sameSite: NODE_ENV === "production" ? "none" : "lax", // none for cross-domain
    httpOnly: true, // Keep secure but allow cross-domain
    // No domain restriction for cross-origin requests
  },
}));

// ==================== HEALTH & INFO ENDPOINTS ====================

app.get("/", (req, res) => {
  res.json({
    message: "RVU Connect API Server",
    environment: NODE_ENV,
    version: "2.0.0",
    status: "running",
    endpoints: {
      health: "GET /api/health",
      session: "GET /check-session",
      auth: {
        signup: "POST /api/auth/signup",
        login: "POST /api/auth/login",
        google: "POST /api/auth/google",
        logout: "POST /api/auth/logout",
        check: "GET /api/auth/check"
      },
      posts: "GET /api/posts",
      events: "GET /api/events"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    environment: NODE_ENV,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    session: req.sessionID ? "active" : "no session",
    allowedOrigins: getAllowedOrigins(),
    timestamp: new Date().toISOString(),
  });
});

// Check session endpoint
app.get("/check-session", (req, res) => {
  if (req.session.user) {
    res.json({ message: "Session active", user: req.session.user });
  } else {
    res.json({ message: "No active session" });
  }
});

// ==================== ROUTE LOADING ====================

const loadRoute = (path, mountPath, name) => {
  try {
    const router = require(path);
    app.use(mountPath, router);
    console.log(`✅ ${name} routes loaded`);
  } catch (error) {
    console.log(`❌ ${name} routes failed:`, error.message);
  }
};

// Load all routes
loadRoute("./Routes/authRoute", "/api/auth", "Auth");
loadRoute("./Routes/postsRoute", "/api/posts", "Posts");
loadRoute("./Routes/eventRoute", "/api/events", "Events");
loadRoute("./Routes/eventAuthRoute", "/api/event-auth", "Event Auth");
loadRoute("./Routes/commentRoute", "/api/comments", "Comments");
loadRoute("./Routes/gangsRoute", "/api/gangs", "Gangs");
loadRoute("./Routes/gangPostsRoute", "/api/gang-posts", "Gang Posts");
loadRoute("./Routes/collabRoutes", "/api/contributions", "Contributions");
loadRoute("./Routes/messagesRoute", "/api/messages", "Messages");
loadRoute("./Bot/routes/botRoute", "/api/bot", "Bot");
loadRoute("./Bot/routes/testroute", "/api/test", "Test");
loadRoute("./Bot/routes/gemini", "/api/gemini", "Gemini");
loadRoute("./test-session", "/api/session-test", "Session Test");

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
    suggestion: "Check the API documentation for available endpoints"
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("🚨 Server error:", error);
  
  // Don't leak error details in production
  const errorMessage = NODE_ENV === "production" 
    ? "Internal server error" 
    : error.message;
    
  res.status(error.status || 500).json({
    error: errorMessage,
    ...(NODE_ENV === "development" && { stack: error.stack })
  });
});

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ Connected to MongoDB");

    // Initialize Socket.IO
    const { Server } = require("socket.io");
    const io = new Server(server, {
      cors: {
        origin: getAllowedOrigins(),
        methods: ["GET", "POST"],
        credentials: true
      },
    });

    // Socket.IO connection handling
    io.on("connection", (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      socket.on("joinGang", (gangId) => {
        socket.join(gangId);
        console.log(`👥 Socket ${socket.id} joined gang: ${gangId}`);
      });

      socket.on("leaveGang", (gangId) => {
        socket.leave(gangId);
        console.log(`👋 Socket ${socket.id} left gang: ${gangId}`);
      });

      socket.on("newMessage", (msg) => {
        if (msg?.gangId) {
          io.to(msg.gangId).emit("message", msg);
        }
      });

      socket.on("newPost", (post) => {
        if (post?.gangId) {
          io.to(post.gangId).emit("post", post);
        }
      });

      socket.on("disconnect", () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
      });
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`\n🚀 SERVER RUNNING`);
      console.log(`📍 URL: ${BACKEND_URLS[NODE_ENV]}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔍 Health Check: ${BACKEND_URLS[NODE_ENV]}/api/health`);
      console.log(`🔐 Auth Endpoint: ${BACKEND_URLS[NODE_ENV]}/api/auth`);
      console.log(`📝 Posts Endpoint: ${BACKEND_URLS[NODE_ENV]}/api/posts`);
      console.log(`\n✨ All systems operational!`);
    });

    // Export io for use in other modules
    global.io = io;

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close server
    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    // Close database connection
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server };