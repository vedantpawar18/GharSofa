import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/orderModel.js";
import Wallet from "../models/walletModel.js";
import Products from "../models/productModel.js";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order for card payments
export const createRazorpayOrder = async (req, res) => {
  try {
    const { totalPrice } = req.body;
    const options = {
      amount: totalPrice * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ orderId: order.id });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Failed to create payment order" });
  }
};

// Verify Razorpay payment
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderData,
    } = req.body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Create order with payment details
    const order = new Order({
      ...orderData,
      payment: {
        method: "Card",
        status: "Completed",
        razorpayOrderId,
        razorpayPaymentId,
      },
      status: "Pending",
    });

    await order.save();

    // Update product stock
    for (const item of orderData.items) {
      const product = await Products.findById(item.product);
      if (product) {
        product.stock -= item.quantity;
        const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock -= item.quantity;
        }
        await product.save();
      }
    }

    res.status(200).json({ message: "Payment verified successfully", order });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Failed to verify payment" });
  }
};

// Handle UPI payment
export const handleUPIPayment = async (req, res) => {
  try {
    const { orderData, upiId } = req.body;

    const order = new Order({
      ...orderData,
      payment: {
        method: "UPI",
        status: "Pending",
        upiId,
      },
      status: "Pending",
    });

    await order.save();

    // Update product stock
    for (const item of orderData.items) {
      const product = await Products.findById(item.product);
      if (product) {
        product.stock -= item.quantity;
        const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock -= item.quantity;
        }
        await product.save();
      }
    }

    res.status(200).json({ message: "UPI payment initiated", order });
  } catch (error) {
    console.error("Error processing UPI payment:", error);
    res.status(500).json({ message: "Failed to process UPI payment" });
  }
};

// Handle Cash on Delivery
export const handleCOD = async (req, res) => {
  try {
    const { orderData } = req.body;

    const order = new Order({
      ...orderData,
      payment: {
        method: "Cash on Delivery",
        status: "Pending",
      },
      status: "Pending",
    });

    await order.save();

    // Update product stock
    for (const item of orderData.items) {
      const product = await Products.findById(item.product);
      if (product) {
        product.stock -= item.quantity;
        const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock -= item.quantity;
        }
        await product.save();
      }
    }

    res.status(200).json({ message: "COD order placed successfully", order });
  } catch (error) {
    console.error("Error processing COD order:", error);
    res.status(500).json({ message: "Failed to place COD order" });
  }
};

// Handle Wallet payment
export const handleWalletPayment = async (req, res) => {
  try {
    const { orderData, userId } = req.body;

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < orderData.finalPrice) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // Deduct amount from wallet
    wallet.balance -= orderData.finalPrice;
    wallet.transactions.push({
      type: "Purchase",
      amount: orderData.finalPrice,
      description: `Order payment for order at ${new Date().toLocaleString()}`,
    });
    await wallet.save();

    // Create order
    const order = new Order({
      ...orderData,
      payment: {
        method: "Wallet",
        status: "Completed",
      },
      status: "Pending",
    });

    await order.save();

    // Update product stock
    for (const item of orderData.items) {
      const product = await Products.findById(item.product);
      if (product) {
        product.stock -= item.quantity;
        const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock -= item.quantity;
        }
        await product.save();
      }
    }

    res.status(200).json({ message: "Wallet payment successful", order });
  } catch (error) {
    console.error("Error processing wallet payment:", error);
    res.status(500).json({ message: "Failed to process wallet payment" });
  }
};

// Handle payment failure
export const handlePaymentFailure = async (req, res) => {
  try {
    const { orderData, errorDetails } = req.body;

    const order = new Order({
      ...orderData,
      payment: {
        method: orderData.payment.method,
        status: "Failed",
        errorDetails,
      },
      status: "Payment Failed",
    });

    await order.save();

    // Restore product stock
    for (const item of orderData.items) {
      const product = await Products.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock += item.quantity;
        }
        await product.save();
      }
    }

    res.status(200).json({ message: "Payment failure recorded", order });
  } catch (error) {
    console.error("Error handling payment failure:", error);
    res.status(500).json({ message: "Failed to handle payment failure" });
  }
}; 