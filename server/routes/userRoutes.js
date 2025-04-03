import express from "express";
import { loginUser, logOutUser, registerUser } from "../controllers/authController.js";
import { isAuth } from "../middleware/isAuth.js";
import {
  getUserDetials,
  getAllUser,
  updateUserDetials,
  blockUser,
  deleteUser,
  addNewAddress,
  getAddressDetials,
  removeAddress,
  setDefaultAddress,
  updateAddress
} from "../controllers/userController.js";

const router = express.Router();

// Auth routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logOutUser);

// Protected user routes
router.use(isAuth); // All routes below this will require authentication

// User profile routes
router.get("/profile", getUserDetials);
router.put("/update-profile", updateUserDetials);
router.put("/update-user-detials", updateUserDetials);
router.put("/customers", updateUserDetials);

// Address routes
router.post("/add-new-address", addNewAddress);
router.get("/user-address", getAddressDetials);
router.delete("/remove-address/:addressId", removeAddress);
router.put("/select-default-address/:addressId", setDefaultAddress);
router.put("/update-address/:addressId", updateAddress);

// Admin only routes
router.get("/all-users", getAllUser);
router.put("/block-user/:id", blockUser);
router.delete("/delete-user/:id", deleteUser);

export default router;
  