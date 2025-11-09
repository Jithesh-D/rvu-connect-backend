const authMiddleware = (req, res, next) => {
  const debugInfo = {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    userId: req.session?.user?.id,
    userEmail: req.session?.user?.email,
    hasCookies: !!req.headers.cookie,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  };
  
  console.log("🔍 Auth check:", debugInfo);

  if (!req.session || !req.session.user) {
    console.log("❌ Auth failed:", {
      reason: !req.session ? "No session" : "No user in session",
      sessionId: req.sessionID
    });
    return res.status(401).json({ 
      error: "Unauthorized - Please login first",
      sessionId: req.sessionID,
      hasSession: !!req.session
    });
  }

  // Make sure user object has the expected structure
  req.user = {
    _id: req.session.user.id,
    id: req.session.user.id,
    ...req.session.user
  };

  console.log("✅ Auth success for user:", req.session.user.email);
  next();
};

module.exports = authMiddleware;
