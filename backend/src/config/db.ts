import mongoose from "mongoose";

/**
 * Connects to MongoDB using the URI from environment variables.
 *
 * Why a separate function instead of connecting inline in server.ts?
 * - Keeps server.ts focused only on "start the HTTP server"
 * - Makes it trivial to reuse this same connection logic in test setup later
 * - If we ever swap connection strategy (e.g. add retry logic, replica set
 *   options, connection pooling settings) there's exactly one place to change it
 */
const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    // Fail fast and loud. A missing DB connection string is a config error,
    // not something the app should silently limp along without.
    console.error("MONGODB_URI is not set in environment variables.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    // Exit the process - there is no point running an API that can't reach its DB.
    process.exit(1);
  }
};

export default connectDB;