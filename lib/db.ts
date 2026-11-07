import { MongoClient } from "mongodb";

const options = {};

let nativeClientPromise: Promise<MongoClient> | undefined;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

// Prevent multiple connections in development (hot reload issue)
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = {
    conn: null,
    promise: null,
  };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // Each Fluid Compute instance has its own pool. Keep this deliberately
      // conservative and let deployments tune it to their Atlas tier.
      maxPoolSize: positiveInteger(process.env.MONGODB_MAX_POOL_SIZE, 10),
      minPoolSize: positiveInteger(process.env.MONGODB_MIN_POOL_SIZE, 0),
      maxIdleTimeMS: positiveInteger(process.env.MONGODB_MAX_IDLE_TIME_MS, 30_000),
      serverSelectionTimeoutMS: positiveInteger(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        10_000
      ),
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export function getMongoClient() {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(MONGODB_URI, options).connect();
    }
    return global._mongoClientPromise;
  }

  if (!nativeClientPromise) {
    nativeClientPromise = new MongoClient(MONGODB_URI, options).connect();
  }
  return nativeClientPromise;
}

export async function closeMongoClient() {
  const pendingClient = process.env.NODE_ENV === "development"
    ? global._mongoClientPromise
    : nativeClientPromise;
  if (!pendingClient) return;

  try {
    await (await pendingClient).close();
  } finally {
    if (process.env.NODE_ENV === "development") global._mongoClientPromise = undefined;
    else nativeClientPromise = undefined;
  }
}
if (!process.env.MONGODB_URI) {
  throw new Error("Please add MONGODB_URI to your environment variables");
}
