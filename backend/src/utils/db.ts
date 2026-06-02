import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/virtual_sports";
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
    console.log("✅ Connecté à MongoDB");
  } catch (err) {
    console.error("❌ Erreur de connexion MongoDB:", err);
    process.exit(1);
  }
}
