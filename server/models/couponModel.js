import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    couponName: {type: String, required: true},
    couponCode: {type: String, required: true, unique: true},
    discount: {type: Number, required: true},
    minPurchaseAmount: {type: Number, required: true},
    maxDiscountAmount: {type: Number, required: true},
    startDate: {type: Date, required: true},
    endDate: {type: Date, required: true},
    description: {type: String}, 
    status: {type: Boolean, default: true},
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }],
  },
  {timestamps: true}
); 

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
