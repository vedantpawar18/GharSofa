import Brands from "../models/brandModel.js";
import Category from "../models/categoryModel.js";
import Products from "../models/productModel.js";
import {calculateOfferPrice} from "../utils/calculateOfferPrice.js";
import {uploadImage, uploadMultipleImages} from "../utils/imageUploadUtil.js";

const createProduct = async (req, res) => {
  try {
    const {
      thumbnail,
      galleryImages,
      productName,
      description,
      category,
      brand,
      roomType,
      materials,
      dimensions,
      colors,
      stock,
      regularPrice,
      salePrice,
      assemblyRequired,
      warranty,
      status,
    } = req.body;
    console.log( thumbnail,
      galleryImages,
      productName,
      description,
      category,
      brand,
      roomType,
      materials,
      dimensions,
      colors,
      stock,
      regularPrice,
      salePrice,
      assemblyRequired,
      warranty,
      status,)
    if (
      !productName ||
      !description ||
      !category ||
      !brand ||
      !roomType ||
      !materials ||
      !dimensions ||
      !colors ||
      !stock ||
      !regularPrice ||
      !salePrice ||
      !warranty
    ) {
      return res.status(400).json({message: "All fields are required"});
    }

    const thumbnailUrl = await uploadImage(
      thumbnail,
      "myProducts/thumbnail",
      600,
      600
    );
    const galleryImageUrls = await uploadMultipleImages(
      galleryImages,
      "myProducts/thumbnail",
      600,
      600
    );

    const newProduct = new Products({
      productName,
      description,
      category,
      brand,
      roomType,
      materials,
      dimensions,
      colors,
      stock,
      regularPrice,
      salePrice,
      assemblyRequired,
      warranty,
      thumbnail: thumbnailUrl,
      gallery: galleryImageUrls,
      status,
    });
    const products = await newProduct.save();
    return res.status(200).json({message: "Product added Successfully"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to add product"});
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await Products.find({})
      .populate("category")
      .populate("brand")
      .populate("offer")
      .populate({
        path: "category",
        populate: {path: "offer"},
      })
      .sort({
        createdAt: -1,
      })
      .limit(12);

    const results = products.map((product) => {
      const productOffer = product.offer?.discountPercentage || 0;
      const categoryOffer = product.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product.offer?.endDate || product.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product.salePrice,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res.status(200).json({message: "Success", products: results});
  } catch (error) {
    return res.status(500).json({message: "Failed to fetch product details"});
  }
};

const getProductsToAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || "";

    const searchFilter = searchQuery
      ? {
          $or: [
            { productName: { $regex: searchQuery, $options: "i" } },
            { description: { $regex: searchQuery, $options: "i" } },
            { material: { $regex: searchQuery, $options: "i" } },
            { color: { $regex: searchQuery, $options: "i" } },
            { roomType: { $regex: searchQuery, $options: "i" } }
          ],
        }
      : {};

    const totalCount = await Products.countDocuments(searchFilter);

    const products = await Products.find(searchFilter)
      .populate("category")
      .populate("brand")
      .populate({
        path: "category",
        populate: { path: "offer" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "Success",
      products: products,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount: totalCount,
    });
  } catch (error) {
    return res.status(500).json({message: "Failed to fetch product details"});
  }
};

const getProductsByRoomType = async (req, res) => {
  try {
    const { roomType } = req.params;
    const query = roomType ? { roomType } : {};
    const products = await Products.find(query)
      .populate("category")
      .populate("brand")
      .populate("offer")
      .populate({
        path: "category",
        populate: {path: "offer"},
      })
      .sort({createdAt: -1});
    
    if (!products) {
      return res.status(400).json({message: "No items found"});
    }

    const results = products.map((product) => {
      const productOffer = product.offer?.discountPercentage || 0;
      const categoryOffer = product.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product.offer?.endDate || product.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product.salePrice,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res
      .status(200)
      .json({message: "Products fetched successfully", products: results});
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({message: "Something went wrong while fetching data"});
  }
};

const getProductsByMaterial = async (req, res) => {
  try {
    const { material } = req.params;
    const query = material ? { material } : {};
    const products = await Products.find(query)
      .populate("category")
      .populate("brand")
      .populate("offer")
      .populate({
        path: "category",
        populate: {path: "offer"},
      })
      .sort({createdAt: -1});
    
    if (!products) {
      return res.status(400).json({message: "No items found"});
    }

    const results = products.map((product) => {
      const productOffer = product.offer?.discountPercentage || 0;
      const categoryOffer = product.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product.offer?.endDate || product.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product.salePrice,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res
      .status(200)
      .json({message: "Products fetched successfully", products: results});
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({message: "Something went wrong while fetching data"});
  }
};

const getProductsByStyle = async (req, res) => {
  try {
    const { style } = req.params;
    const products = await Products.find({
      style: style,
      status: true
    })
      .populate("category")
      .populate("brand")
      .populate("offer")
      .populate({
        path: "category",
        populate: {path: "offer"},
      })
      .sort({createdAt: -1});
    
    if (!products) {
      return res.status(400).json({message: "No items found"});
    }

    const results = products.map((product) => {
      const productOffer = product.offer?.discountPercentage || 0;
      const categoryOffer = product.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product.offer?.endDate || product.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product.salePrice,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res
      .status(200)
      .json({message: "Products fetched successfully", products: results});
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({message: "Something went wrong while fetching data"});
  }
};

const getProductById = async (req, res) => {
  try {
    const {id} = req.params;
    const productDetail = await Products.findById(id)
      .populate("category")
      .populate("brand")
      .populate("offer")
      .populate({
        path: "category",
        populate: {path: "offer"},
      });
    if (!productDetail) {
      return res.status(400).json({message: "Product not found"});
    }

    const productOffer = productDetail.offer?.discountPercentage || 0;
    const categoryOffer =
      productDetail.category?.offer?.discountPercentage || 0;
    const offerExpirationDate =
      productDetail.offer?.endDate || productDetail.category?.offer?.endDate;
    const priceDetails = calculateOfferPrice(
      productDetail.salePrice,
      productOffer,
      categoryOffer,
      offerExpirationDate
    );

    return res
      .status(200)
      .json({
        message: "Product fetch successfully",
        productDetail,
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      });
  } catch (error) {
    return res.status(500).json({message: "Failed to get the product"});
  }
};

const updateProduct = async (req, res) => {
  try {
    const {id} = req.params;
    const {
      thumbnail,
      galleryImages,
      productName,
      description,
      category,
      brand,
      roomType,
      materials,
      dimensions,
      colors,
      stock,
      regularPrice,
      salePrice,
      assemblyRequired,
      warranty,
      status,
    } = req.body;

    const product = await Products.findById(id);
    if (!product) {
      return res.status(400).json({message: "Product not found"});
    }

    // Update basic fields
    product.productName = productName || product.productName;
    product.description = description || product.description;
    product.category = category || product.category;
    product.brand = brand || product.brand;
    product.roomType = roomType || product.roomType;
    product.materials = materials || product.materials;
    product.dimensions = dimensions || product.dimensions;
    product.colors = colors || product.colors;
    product.stock = stock !== undefined ? stock : product.stock;
    product.regularPrice = regularPrice !== undefined ? regularPrice : product.regularPrice;
    product.salePrice = salePrice !== undefined ? salePrice : product.salePrice;
    product.assemblyRequired = assemblyRequired !== undefined ? assemblyRequired : product.assemblyRequired;
    product.warranty = warranty || product.warranty;
    product.status = status !== undefined ? status : product.status;

    const isCloudinaryUrl = (url) => url.startsWith("https://res.cloudinary.com");

    if (thumbnail && !isCloudinaryUrl(thumbnail)) {
      product.thumbnail = await uploadImage(
        thumbnail,
        "myProducts/thumbnail",
        600,
        600
      );
    }

    if (galleryImages) {
      try {
        const uploadedImages = await uploadMultipleImages(
          galleryImages,
          "myProducts/thumbnail",
          600,
          600
        );
        product.gallery = uploadedImages;
      } catch (error) {
        console.error("Error uploading gallery images:", error);
        return res
          .status(500)
          .json({message: "Error uploading gallery images"});
      }
    }

    const updatedProduct = await product.save();
    return res
      .status(200)
      .json({message: "Updated Successfully", product: updatedProduct});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const blockProduct = async (req, res) => {
  try {
    const {status} = req.body;
    const {id} = req.params;
    const product = await Products.findById(id);
    if (!product) {
      return res.status(400).json({message: "Product not found"});
    }
    product.status = !product.status;
    await product.save();
    const productStatusMessage = product.status ? "Active" : "Blocked";
    return res
      .status(200)
      .json({message: `Product is ${productStatusMessage}`, product});
  } catch (error) {
    console.log(error);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const {id} = req.params;
    await Products.findByIdAndDelete(id);
    return res.status(200).json({message: "Product deleted successfully"});
  } catch (error) {
    return res.status(500).json({message: "Failed to delete"});
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await Products.find({})
      .populate("category")
      .populate("brand")
      .populate({
        path: "category",
        populate: {path: "offer"},
      })
      .sort({
        createdAt: -1,
      });
    return res.status(200).json({message: "Success", products: products});
  } catch (error) {
    return res.status(500).json({message: "Failed to fetch product details"});
  }
};

const searchProduct = async (req, res) => {
  try {
    const { query } = req.query;

    let searchItem = {};

    const brands = await Brands.find({ brandName: { $regex: query, $options: "i" } });
    const brandIds = brands.map(brand => brand._id);

    const categories = await Category.find({ categoryName: { $regex: query, $options: "i" } });
    const categoryIds = categories.map(category => category._id);

    if(query) {
      searchItem = {
        $or: [
          {productName: {$regex: query, $options: "i"}},
          {description: {$regex: query, $options: "i"}},
          {material: {$regex: query, $options: "i"}},
          {color: {$regex: query, $options: "i"}},
          {roomType: {$regex: query, $options: "i"}},
          { brand: { $in: brandIds } },
          { category: { $in: categoryIds } }
        ]
      }
    }

    const products = await Products.find(searchItem)
      .populate("category")
      .populate("brand")
      .populate("offer")
      .populate({
        path: "category",
        populate: {path: "offer"},
      });

    return res.status(200).json({message: "Success", products});
  } catch(error) {
    console.log(error);
    return res.status(500).json({message: "Failed"});
  }
};

export {
  createProduct,
  getProducts,
  getProductsToAdmin,
  getProductsByRoomType,
  getProductsByMaterial,
  getProductsByStyle,
  getProductById,
  updateProduct,
  blockProduct,
  deleteProduct,
  getAllProducts,
  searchProduct
};
