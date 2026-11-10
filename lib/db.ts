import { MongoClient, type Db } from "mongodb";

const options = {};

let nativeClient: MongoClient | undefined;
let nativeClientPromise: Promise<MongoClient> | undefined;

declare global {
  var _mongoClient: MongoClient | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
import mongoose from "mongoose";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  return uri;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
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
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const uri = getMongoUri();

  if (!cached.promise || mongoose.connection.readyState === 0) {
    cached.promise = mongoose.connect(uri, {
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

export function getMongoClientInstance(): MongoClient {
  const uri = getMongoUri();
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClient) {
      global._mongoClient = new MongoClient(uri, options);
    }
    return global._mongoClient;
  }

  if (!nativeClient) {
    nativeClient = new MongoClient(uri, options);
  }
  return nativeClient;
}

export function getMongoDb(): Db {
  return getMongoClientInstance().db();
}

export function getMongoClient(): Promise<MongoClient> {
  const client = getMongoClientInstance();
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!nativeClientPromise) {
    nativeClientPromise = client.connect();
  }
  return nativeClientPromise;
}

export async function closeMongoClient() {
  const client = process.env.NODE_ENV === "development"
    ? global._mongoClient
    : nativeClient;
  if (!client) return;

  try {
    await client.close();
  } finally {
    if (process.env.NODE_ENV === "development") {
      global._mongoClient = undefined;
      global._mongoClientPromise = undefined;
    } else {
      nativeClient = undefined;
      nativeClientPromise = undefined;
    }
  }
}

