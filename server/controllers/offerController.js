import Category from "../models/categoryModel.js";
import Offer from "../models/offerModel.js";
import Products from "../models/productModel.js";

const createOffer = async (req, res) => {
  try {
    console.log(req.body);
    const {
      name,
      offerType,
      discountPercentage,
      startDate,
      endDate,
      description,
      targetOfferId,
    } = req.body;

    const offer = new Offer({
      name,
      offerType,
      discountPercentage,
      startDate,
      endDate,
      description,
      targetOfferId,
    });

    await offer.save();

    if (offerType === "Category") {
      await Category.findByIdAndUpdate(targetOfferId, {offer: offer._id});
    } else if (offerType === "Products") {
      await Products.findByIdAndUpdate(targetOfferId, {offer: offer._id});
    }

    let populatedOffer;
    if (offerType === "Category") {
      populatedOffer = await Offer.findById(offer._id)
        .populate({
          path: "targetOfferId",
          select: "categoryName description",
          model: "Category",
        })
        .exec();
    } else if (offerType === "Products") {
      populatedOffer = await Offer.findById(offer._id)
        .populate({
          path: "targetOfferId",
          select: "productName description price thumbnail",
          model: "Products",
        })
        .exec();
    }

    return res.status(201).json({
      message: "Offer created successfully",
      offer: populatedOffer,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({message: "Failed to create the offer"});
  }
};

const getOffers = async (req, res) => {
  try {
    const currentDate = new Date();
    const categoryOffersPromise = Offer.find({
      offerType: "Category",
      // endDate: {$gte: currentDate},
    })
      .populate({
        path: "targetOfferId",
        select: "categoryName description",
        model: "Category",
      })
      .exec();

    const productOffersPromise = Offer.find({
      offerType: "Products",
      // endDate: {$gte: currentDate},
    })
      .populate({
        path: "targetOfferId",
        select: "productName description price thumbnail",
        model: "Products",
      })
      .exec();

    const [categoryOffers, productOffers] = await Promise.all([
      categoryOffersPromise,
      productOffersPromise,
    ]);

    res.status(200).json({
      categoryOffers,
      productOffers,
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res
      .status(500)
      .json({message: "Error fetching offers", error: error.message});
  }
};

const deleteOffer = async (req, res) => {
  try {
    const {offerId} = req.params;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({message: "Offer not found"});
    }

    if (offer.offerType === "Category") {
      await Category.findByIdAndUpdate(offer.targetOfferId, {offer: null});
    } else if (offer.offerType === "Products") {
      await Products.findByIdAndUpdate(offer.targetOfferId, {offer: null});
    }

    await Offer.findByIdAndDelete(offerId);

    return res.status(200).json({message: "Offer deleted successfully"});
  } catch (error) {
    console.error("Error deleting offer:", error);
    return res.status(500).json({message: "Failed to delete the offer"});
  }
};

export {createOffer, getOffers, deleteOffer};
