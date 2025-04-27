import Users from "../models/userModel.js";
import bcrypt from "bcrypt";
import {generateToken} from "../utils/genetateToken.js";

const registerUser = async (req, res) => {
  try {
    const {firstName, lastName, email, phoneNumber, password} = req.body;
    
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({message: "All fields are required"});
    }

    const userExist = await Users.findOne({email: email});
    if (userExist) {
      return res.status(400).json({message: "User already exists"});
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const user = new Users({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashPassword,
      isVerified: true 
    });

    const userData = await user.save();
    const userResponse = {...userData.toObject()};
    delete userResponse.password;

    return res.status(200).json({
      message: "User registered successfully", 
      userData: userResponse
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({message: "Failed to register the user", error});
  }
};

const loginUser = async (req, res) => {
  try {
    const {email, password} = req.body;
    if (!email || !password) {
      return res.status(400).json({message: "All fields are required"});
    }
    
    const userData = await Users.findOne({email});
    if (!userData) {
      return res.status(401).json({message: "Invalid email or password"});
    }

    const matchPassword = await bcrypt.compare(password, userData.password);
    if (!matchPassword) {
      return res.status(401).json({message: "Invalid email or password"});
    }

    generateToken(res, userData);
    const userResponse = {...userData.toObject()};
    delete userResponse.password;

    return res.status(200).json({
      message: "Login successful", 
      userData: userResponse
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Login failed"});
  }
};


const logOutUser = async (req, res) => {
  res.cookie("jwtToken", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({message: "Logged out successfully"});
};

export {registerUser, loginUser, logOutUser};
