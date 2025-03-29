import mongoose from "mongoose";

const connectDB = async () => {;
  const URI = process.env.MONGO_URI;
  return mongoose
    .connect(URI)
    .then(() => {
      console.log("database connected successfully");
    })
    .catch((error) => {
      console.log("database connection failed ", error);
    });
};

export default connectDB;
