import express from "express";
import userRoute from "./userRoutes.js"; 

const app = express.Router() 
app.use("/users", userRoute) 
export default app;   