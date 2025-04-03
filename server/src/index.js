import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/connectDB.js";
import appRoutes from "./routes/apiRoutes.js";

const app = express();

const PORT = 8000;
dotenv.config();
connectDB();

app.use(cookieParser());

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "gharsofa server starts" });
});

app.use("/api", appRoutes);

app.listen(PORT, () => {
  console.log(`server start running at ${PORT}`);
});
