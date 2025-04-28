import WishList from "../models/wishListModel.js";
import { calculateOfferPrice } from "../utils/calculateOfferPrice.js";

//addwishListItems
const addItemToWishList = async (req, res) => {
  try {
    const {productId} = req.body;
    const userId = req.user.id;

    let wishList = await WishList.findOne({user: userId});
    if (!wishList) {
      wishList = new WishList({user: userId, products: [productId]});
    } else {
      if (!wishList.products.includes(productId)) {
        wishList.products.push(productId);
      }
    }
    await wishList.save();
    return res
      .status(200)
      .json({message: "Add product to wishList", wishList: wishList});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to add product to wishList"});
  }
};

//removewishlistItems
const removeItemFromWishList = async (req, res) => {
  try {
    const {productId} = req.params;
    const userId = req.user.id;

    const wishList = await WishList.findOneAndUpdate(
      {user: userId},
      {$pull: {products: productId}},
      {new: true}
    );
    if (!wishList) {
      return res.status(404).json({message: "Wishlist not found"});
    }
    return res.status(200).json({message: "Removed successfully"});
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({message: "Failed to remove product from wishList"});
  }
};

//getwishListItems
const getWishListItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const wishList = await WishList.findOne({user: userId})
      // .populate("products")
      .populate({
        path: "products",
        populate: [
          {path: "offer"},
          {
            path: "category",
            model: "Category",
            populate: {
              path: "offer",
              model: "Offer", 
            },
          },
        ],
      });
    if (!wishList) {
      return res.status(400).json({message: "WishList not found"});
    }


    const results = wishList?.products.map((product) => {
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

    // return res.status(200).json({message: "Fetched successfully", wishList});

    return res.status(200).json({
      message: "Fetched successfully",
      wishList: {
        ...wishList.toObject(),
        products: results, 
      },
    });


  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to fetch wishlist details"});
  }
};

export {addItemToWishList, removeItemFromWishList, getWishListItems};
