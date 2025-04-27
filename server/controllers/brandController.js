import Brands from "../models/brandModel.js";
import {uploadImage} from "../utils/imageUploadUtil.js";

const addBrand = async (req, res) => {
  try {
    const {brandName, brandTitle, logo, description, countryOfOrigin, yearEstablished, specialties} = req.body;
    const logoUrl = await uploadImage(logo, "myBrand", 200, 200);
    
    if (!brandName) {  
      return res.status(400).json({message: "brandName is required"});     
    }  
    const existingBrandName = await Brands.findOne({brandName});
    if (existingBrandName) {
      return res.status(400).json({message: "Existing Brand"});   
    }
    const brand = new Brands({
      brandName,
      brandTitle,
      logo: logoUrl,
      description,
      countryOfOrigin,
      yearEstablished,
      specialties
    });
    const brandData = await brand.save()
    return res.status(200).json({message: "Brand added successfully"})
  } catch (error) {
    return res.status(500).json({message: "Add brand failed", error:error});
  }
};

const getBrand = async (req, res) => {
  try {
    const brandData = await Brands.find()
    return res.status(200).json({message: "brand data", brandData})
  } catch (error) {
    return res.status(500).json({message: "Something went wrong"})
  }
}

const getBrandById = async (req, res) => {
  try {
    const {id} = req.params;
    const brand = await Brands.findById(id);
    if (!brand) {
      return res.status(404).json({message: "Brand not found"});
    }
    return res.status(200).json({message: "Brand found", brand});
  } catch (error) {
    return res.status(500).json({message: "Something went wrong"});
  }
};

const updateBrand = async (req, res) => {
  try {
    const {id} = req.params;
    const {brandName, brandTitle, logo, description, countryOfOrigin, yearEstablished, specialties, status} = req.body;
    
    const brand = await Brands.findById(id);
    if (!brand) {
      return res.status(404).json({message: "Brand not found"});
    }

    const existingBrand = await Brands.findOne({brandName, _id: {$ne: id}});
    if (existingBrand) {
      return res.status(400).json({message: "Brand name already exists"});
    }

    let logoUrl = brand.logo;
    if (logo && !logo.startsWith("https://res.cloudinary.com")) {
      logoUrl = await uploadImage(logo, "myBrand", 200, 200);
    }

    brand.brandName = brandName || brand.brandName;
    brand.brandTitle = brandTitle || brand.brandTitle;
    brand.logo = logoUrl;
    brand.description = description || brand.description;
    brand.countryOfOrigin = countryOfOrigin || brand.countryOfOrigin;
    brand.yearEstablished = yearEstablished || brand.yearEstablished;
    brand.specialties = specialties || brand.specialties;
    brand.status = status !== undefined ? status : brand.status;

    await brand.save();
    return res.status(200).json({message: "Brand updated successfully", brand});
  } catch (error) {
    return res.status(500).json({message: "Failed to update brand"});
  }
};

const deleteBrand = async (req, res) => {
  try {
    const {id} = req.params;
    const brand = await Brands.findById(id);
    if (!brand) {
      return res.status(404).json({message: "Brand not found"});
    }
    await Brands.findByIdAndDelete(id);
    return res.status(200).json({message: "Brand deleted successfully"});
  } catch (error) {
    return res.status(500).json({message: "Failed to delete brand"});
  }
};

const getBrandsBySpecialty = async (req, res) => {
  try {
    const {specialty} = req.params;
    const brands = await Brands.find({
      specialties: specialty,
      status: true
    });
    return res.status(200).json({message: "Brands found", brands});
  } catch (error) {
    return res.status(500).json({message: "Failed to fetch brands"});
  }
};

const getBrandsByCountry = async (req, res) => {
  try {
    const {country} = req.params;
    const brands = await Brands.find({
      countryOfOrigin: country,
      status: true
    });
    return res.status(200).json({message: "Brands found", brands});
  } catch (error) {
    return res.status(500).json({message: "Failed to fetch brands"});
  }
};

export {
  addBrand,
  getBrand,
  getBrandById,
  updateBrand,
  deleteBrand,
  getBrandsBySpecialty,
  getBrandsByCountry
};