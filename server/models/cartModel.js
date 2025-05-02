import mongoose, { Types } from "mongoose";

const cartItemSchema = new mongoose.Schema({
    productId : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Products",
        required: true
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    },
    color: { type: String, required: true },
    material: { type: String, required: true },
    assemblyRequired: { type: Boolean, required: true },
    productDiscount: {type: Number},
    offerPrice: {type: Number},
    priceWithoutOffer: {type: Number},
})   

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    items: [cartItemSchema],
    couponDiscount: {
        type: Number,
        default: 0,
    },
    appliedCoupon: {
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
        code: String,
        discount: Number,
        appliedAt: Date
      }
})

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;