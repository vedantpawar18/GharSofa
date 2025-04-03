import {json} from "express";
import Category from "../models/categoryModel.js";
import Users from "../models/userModel.js";
import {uploadImage} from "../utils/imageUploadUtil.js";

const getUserDetials = async (req, res) => { 
  try {
    const userId = req.user.id;
    const userData = await Users.findById(userId).select("-password");
    if (!userData) {
      return res.status(404).json({message: "user not found"});
    }
    return res.status(200).json({message: "success", user: userData});
  } catch (error) {
    console.error(error);
    res.status(500).json({message: "Failed to fetch the user"});
  }
};

const getAllUser = async (req, res) => { 
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchQuery = req.query.search || '';
    const searchFilter = {
      role: false,
      $or: [
        { firstName: { $regex: searchQuery, $options: 'i' } },
        { lastName: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ],
    };

    // const totalCount = await Users.countDocuments({role: false});
    // const users = await Users.find({role: false})
    //   .select("-password")
    //   .skip(skip)
    //   .limit(limit);

    const totalCount = await Users.countDocuments(searchFilter);
    const users = await Users.find(searchFilter)
      .select("-password")
      .skip(skip)
      .limit(limit);


    return res.status(200).json({
      message: "fetch user detials successfully",
      users: users,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount: totalCount,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Somthing went wrong"});
  }
};

const updateUserDetials = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const {firstName, lastName, phoneNumber, dpImage} = req.body;
    
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({message: "User not found"});
    }

    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    
    if (dpImage) {
      user.dpImage = await uploadImage(dpImage, "profile", 600, 600);
    }

    const updatedUser = await user.save();
    return res.status(200).json({
      message: "Updated successfully", 
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      message: "Failed to update user",
      error: error.message
    });
  }
};

const blockUser = async (req, res) => {
  try {
    const {id} = req.params;
    const user = await Users.findById(id);
    if (!user) {
      return res.status(400).json({message: "User not found"});
    }
    user.isVerified = !user.isVerified;
    await user.save();
    const verifiedMessage = user.isVerified ? "Active" : "Blocked";
    return res.status(200).json({message: `User is ${verifiedMessage}`, user});
  } catch (error) {
    console.log(error);
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(400).json({message: "Invalid user ID format"});
    }

    return res.status(500).json({message: "Failed to block user"});
  }
};

const deleteUser = async (req, res) => {
  try {
    const {id} = req.params;
    await Users.findByIdAndDelete(id);
    return res.status(200).json({message: "Delete User successfully"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to delete User"});
  }
};




// address section

const addNewAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      customerName,
      phone,
      address,
      locality,
      city,
      state,
      pinCode,
      typeofPlace,
      isDefaultAddress,
    } = req.body;

    if (
      !customerName ||
      !phone ||
      !address ||
      !locality ||
      !city ||
      !state ||
      !typeofPlace
    ) {
      return res
        .status(400)
        .json({message: "All required fields must be provided"});
    }
    const normalizedTypeofPlace = typeofPlace.toLowerCase();

    const user = await Users.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({message: "User not found"});
    }

    if (isDefaultAddress) {
      user.addresses.forEach((address) => (address.isDefaultAddress = false));
    }
    if (user.addresses.length === 0) {
      user.addresses.push({
        customerName,
        phone,
        address,
        locality,
        city,
        state,
        pinCode,
        typeofPlace: normalizedTypeofPlace,
        isDefaultAddress: true,
      });
    } else {
      user.addresses.push({
        customerName,
        phone,
        address,
        locality,
        city,
        state,
        pinCode,
        typeofPlace: normalizedTypeofPlace,
        isDefaultAddress,
      });
    }

    await user.save();
    return res.status(200).json({message: "Address added successfully", user});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to add address"});
  }
};

const getAddressDetials = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Users.findById(userId);
    
    if (!user) {
      return res.status(404).json({message: "User not found"});
    }

    // Initialize addresses array if it doesn't exist
    if (!user.addresses) {
      user.addresses = [];
      await user.save();
    }

    // Sort addresses with null check
    const sortedAddresses = user.addresses ? 
      user.addresses.sort((a, b) => {
        return (b.isDefaultAddress || false) - (a.isDefaultAddress || false);
      }) : [];

    return res.status(200).json({
      message: "Success", 
      addresses: sortedAddresses,
      totalAddresses: sortedAddresses.length
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return res.status(500).json({
      message: "Something went wrong while fetching addresses",
      error: error.message
    });
  }
};

const removeAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {addressId} = req.params;

    const user = await Users.findByIdAndUpdate(
      userId,
      {$pull: {addresses: {_id: addressId}}},
      {new: true}
    );
    return res.status(200).json({message: "Address removed successfully"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {addressId} = req.params;

    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({message: "User not found"});
    }

    user.addresses.forEach((address) => {
      address.isDefaultAddress = false;
    });

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({message: "Address not found"});
    }
    address.isDefaultAddress = true;
    await user.save();

    res.status(200).json({
      message: "Default address updated successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({message: "Something went wrong"});
  }
};

const updateAddress = async (req, res) => {
  try{
    const userId = req.user.id;
    const {addressId} = req.params;
    const {
      customerName,
      phone,
      address,
      locality,
      city,
      state,
      pinCode,
      typeofPlace,
      isDefaultAddress,
    } = req.body;

    const user = await Users.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const addressToUpdate = user.addresses.id(addressId);
    if (!addressToUpdate) {
      return res.status(404).json({ message: "Address not found" });
    }  

    const normalizedTypeofPlace = typeofPlace.toLowerCase();

    if (isDefaultAddress) {
      user.addresses.forEach((addr) => (addr.isDefaultAddress = false));
    }

    addressToUpdate.customerName = customerName || addressToUpdate.customerName;
    addressToUpdate.phone = phone || addressToUpdate.phone;
    addressToUpdate.address = address || addressToUpdate.address ;
    addressToUpdate.locality = locality || addressToUpdate.locality;
    addressToUpdate.city = city || addressToUpdate.city;                 
    addressToUpdate.state = state || addressToUpdate.state;
    addressToUpdate.pinCode = pinCode || addressToUpdate.pinCode;
    addressToUpdate.typeofPlace = normalizedTypeofPlace || addressToUpdate.typeofPlace;
    addressToUpdate.isDefaultAddress = isDefaultAddress;

    await user.save();
    return res.status(200).json({message: "Updated Successfully", user})
  }catch(error){
    console.log(error)
    return res.status(500).json({message: "Something went wrong"})
  }
}

export {
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
};
