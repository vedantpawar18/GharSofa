import Cart from "../models/cartModel.js";
import Coupon from "../models/couponModel.js";
import {calculateOfferPrice} from "../utils/calculateOfferPrice.js";

const addCoupon = async (req, res) => {
  console.log(req.body);
  try {
    const {
      couponName,
      couponCode,
      discount,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      status,
      description,
    } = req.body;

    if (
      !couponName ||
      !couponCode ||
      !discount ||
      !minPurchaseAmount ||
      !maxDiscountAmount ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({message: "All fields are required"});
    }

    const existingCoupon = await Coupon.findOne({couponCode});
    if (existingCoupon) {
      return res.status(400).json({message: "Coupon code already exists"});
    }

    const coupons = new Coupon({
      couponName,
      couponCode,
      discount,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      status,
      description,
    });

    await coupons.save();
    return res.status(200).json({message: "coupon added Succesfully", coupons});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to add coupon"});
  }
};

const getCouponsAdmin = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    return res.status(200).json({message: "Success", coupons});
  } catch (error) {
    console.log(error);
    return res.status(200).json({message: "Something went wrog"});
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const {couponId} = req.params;
    await Coupon.findByIdAndDelete(couponId);
    return res.status(200).json({message: "Delete Successfully"});
  } catch (error) {
    console.log(error);
    return res.status(200).json({message: "Something went wrog"});
  }
};

const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.user.id;
    const {totalPrice} = req.query;

    if (!totalPrice) {
      return res.status(400).json({message: "Total price is required"});
    }

    const availableCoupons = await Coupon.find({
      minPurchaseAmount: {$lte: totalPrice},
      // startDate: { $lte: new Date() },
      endDate: {$gte: new Date()},
      status: true,
      usedBy: {$ne: userId},
    });

    if (!availableCoupons.length) {
      return res.status(404).json({message: "No coupons available"});
    }

    return res
      .status(200)
      .json({message: "Coupons found", coupons: availableCoupons});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: "Failed to retrieve coupons"});
  }
};

const applyCoupon = async (req, res) => {
  try {
    const {couponId} = req.body;
    const userId = req.user.id;

    const coupon = await Coupon.findById(couponId);
    if (
      !coupon ||
      !coupon.status ||
      new Date() < coupon.startDate ||
      new Date() > coupon.endDate
    ) {
      return res.status(400).json({message: "Invalid or expired coupon"});
    }

    const cart = await Cart.findOne({user: userId}).populate({
      path: "items.productId",
      populate: [
        {path: "brand"},
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

    if (!cart) {
      return res.status(400).json({message: "Cart not found"});
    }

    let totalPriceAfterDiscount = 0;

    cart.items.forEach((item) => {
      const product = item.productId;
      const productOffer = product?.offer?.discountPercentage || 0;
      const categoryOffer = product?.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product?.offer?.endDate || product?.category?.offer?.endDate;

      const priceDetails = calculateOfferPrice(
        product.salePrice,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );

      totalPriceAfterDiscount +=
        (priceDetails.discountedPrice || product.salePrice) * item.quantity;
    });

    if (totalPriceAfterDiscount < coupon.minPurchaseAmount) {
      return res
        .status(400)
        .json({
          message: `Minimum purchase amount of ${coupon.minPurchaseAmount} not met`,
        });
    }

    const discountAmount = (totalPriceAfterDiscount * coupon.discount) / 100;
    const finalDiscountAmount = Math.min(
      discountAmount,
      coupon.maxDiscountAmount
    );

    cart.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.couponCode,
      discount: finalDiscountAmount,
      appliedAt: new Date(),
    };

    await cart.save();

    return res
      .status(200)
      .json({
        message: "Coupon applied successfully",
        appliedCoupon: cart.appliedCoupon,
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to applay coupons"});
  }
};

const removeCoupon = async (req, res) => {
  try{

    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(400).json({ message: "Cart not found" });
    }

    if (!cart.appliedCoupon || !cart.appliedCoupon.couponId) {
      return res.status(400).json({ message: "No coupon applied to the cart" });
    }

    cart.appliedCoupon = null;

    await cart.save();
 

    return res.status(200).json({message: "Success", cart})
  }catch(error){
    console.log(error)
    return res.status(500).json({message: "Failed to remove coupons"})
  }
}

export {
  addCoupon, 
  getCouponsAdmin,
  deleteCoupon,
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
};
