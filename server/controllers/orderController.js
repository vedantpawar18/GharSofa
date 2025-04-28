import Order from "../models/orderModel.js";
import Products from "../models/productModel.js";
import Cart from "../models/cartModel.js";
// import Razorpay from "razorpay";
import crypto from "crypto";
import Wallet from "../models/walletModel.js";
import Users from "../models/userModel.js";
import PDFDocument from "pdfkit";

const calculateOfferPrice = (basePrice, productOffer = 0, categoryOffer = 0, expirationDate = null) => {
  // Check if any offers have expired
  if (expirationDate && new Date(expirationDate) < new Date()) {
    return {
      offerPrice: basePrice,
      offerPercentage: 0,
      savedAmount: 0
    };
  }

  // Get the highest applicable discount
  const maxDiscount = Math.max(productOffer, categoryOffer);
  
  if (maxDiscount === 0) {
    return {
      offerPrice: basePrice,
      offerPercentage: 0,
      savedAmount: 0
    };
  }

  const offerPrice = basePrice - (basePrice * (maxDiscount / 100));
  const savedAmount = basePrice - offerPrice;

  return {
    offerPrice: Math.round(offerPrice),
    offerPercentage: maxDiscount,
    savedAmount: Math.round(savedAmount)
  };
};

const createOrder = async (req, res) => {
  try {
    const {
      items,
      address,
      totalPrice,
      deliveryCharge,
      originalTotalPrice,
      totalPriceAfterDiscount,
      savedTotal,
      couponDiscount,
      finalPrice,
      payment,
    } = req.body;
    const userId = req.user.id;

    if (!items || !address || !totalPrice || !payment) {
      return res.status(400).json({message: "Missing required fields"});
    }

    const orderItems = [];

    for (const item of items) {
      const product = await Products.findById(item.product);
      if (!product) {
        return res
          .status(404)
          .json({message: `Product ${item.product} not found`});
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product ${product.productName}`,
        });
      }

      // Handle color validation
      const itemColor = item.color || product.colors[0]; // Use first available color if none specified
      if (!itemColor) {
        return res.status(400).json({
          message: `No color specified for product ${product.productName}`,
          availableColors: product.colors
        });
      }
      
      if (!product.colors.includes(itemColor)) {
        return res.status(400).json({
          message: `Color ${itemColor} is not available for ${product.productName}`,
          availableColors: product.colors,
          selectedColor: itemColor
        });
      }

      // Update stock
      product.stock -= item.quantity;
      await product.save();

      // Create order item with furniture-specific details
      orderItems.push({
        product: item.product,
        productName: item.productName || product.productName,
        productBrand: item.productBrand || product.brand,
        description: item.description || product.description,
        price: item.price,
        regularPrice: item.regularPrice || product.regularPrice,
        quantity: item.quantity,
        color: itemColor,
        material: product.materials[0], // Using first material from product's materials array
        assemblyRequired: product.assemblyRequired || false,
        totalPrice: item.totalPrice,
        thumbnail: item.thumbnail || product.thumbnail
      });
    }

    // Handle different payment methods
    if (payment.method === "Wallet") {
      const wallet = await Wallet.findOne({user: userId});
      if (!wallet || wallet.balance < finalPrice) {
        return res.status(400).json({message: "Insufficient wallet balance"});
      }

      wallet.balance -= finalPrice;
      wallet.transactions.push({
        type: "Purchase",
        amount: finalPrice,
        description: `Order payment for order at ${new Date().toLocaleString()}`,
      });
      await wallet.save();
      payment.status = "Completed";
    } else if (payment.method === "UPI") {
      payment.status = "Pending";
    } else if (payment.method === "Cash on Delivery") {
      payment.status = "Pending";
    }

    const newOrder = new Order({
      user: userId,
      items: orderItems,
      address,
      totalPrice,
      deliveryCharge,
      originalTotalPrice,
      totalPriceAfterDiscount,
      savedTotal,
      couponDiscount,
      finalPrice,
      payment,
      status: payment.status === "Completed" ? "Processing" : "Pending",
    });

    const savedOrder = await newOrder.save();

    // Clear cart only for completed payments
    if (payment.status === "Completed") {
      await Cart.findOneAndUpdate(
        {user: userId},
        {$set: {items: [], couponDiscount: 0}}
      );
    }

    res.status(200).json({
      message: "Order created successfully", 
      order: savedOrder,
      paymentStatus: payment.status
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({
      message: "Failed to create order",
      error: error.message
    });
  }
};

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });
const verifyRazorpayPayment = async (req, res) => {
  const userId = req.user.id;
  const {totalPrice} = req.body;

  if (!totalPrice) {
    return res.status(400).json({message: "Total price is required"});
  }

  const options = {
    amount: totalPrice * 100,
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  };
  try {
    const razorpayOrder = await razorpay.orders.create(options);
    res.status(200).json({orderId: razorpayOrder.id});
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({message: "Failed to create Razorpay order"});
  }
};

const createRazorpayOrder = async (req, res) => {
  const userId = req.user.id;
  const {razorpayOrderId, razorpayPaymentId, razorpaySignature, orderData} =
    req.body;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RZP_SECRET_KEY)
    .update(razorpayOrderId + "|" + razorpayPaymentId)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    try {
      const newOrder = new Order({
        user: userId,
        ...orderData,
        payment: {
          method: "UPI",
          status: "Failed",
          razorpayOrderId,
        },
        status: "Payment Pending",
      });

      console.log("from the failed payment", newOrder);
      const savedOrder = await newOrder.save();
      return res
        .status(200)
        .json({message: "Order created, payment pending", order: savedOrder});
    } catch (error) {
      console.error("Error saving order:", error);
      return res.status(500).json({message: "Failed to save order"});
    }
  }

  try {
    const newOrder = new Order({
      user: userId,
      ...orderData,
      payment: {
        method: "UPI",
        status: "Completed",
        razorpayOrderId,
        razorpayPaymentId,
      },
      status: "Pending",
    });
    // console.log("this is frm the order creation in verifyrzp", newOrder);

    const savedOrder = await newOrder.save();

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

    res.status(200).json({message: "Order confirmed", order: savedOrder});
  } catch (error) {
    console.error("Error saving order:", error);
    res.status(500).json({message: "Failed to save order"});
  }
};

const handlePaymentFailure = async (req, res) => {
  console.log("this is from the payment failer", req.body);
  const userId = req.user.id;
  const {razorpayOrderId, razorpayPaymentId, errorDetails, orderData} =
    req.body;

  try {
    const failedOrder = new Order({
      user: userId,
      ...orderData,
      payment: {
        method: "UPI",
        status: "Failed",
        razorpayOrderId,
        razorpayPaymentId,
        errorDetails,
      },
      status: "Payment Failed",
    });

    const savedOrder = await failedOrder.save();

    await Cart.findOneAndUpdate(
      {user: userId},
      {$set: {items: []}},
      {new: true}
    );

    res.status(200).json({
      message: "Order created with payment failure",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Error saving failed order:", error);
    res
      .status(500)
      .json({message: "Failed to save order after payment failure"});
  }
};

const retryPayment = async (req, res) => {
  try {
    const {orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature} =
      req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({message: "Order not found"});
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RZP_SECRET_KEY)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({message: "Invalid payment signature"});
    }

    order.status = "Processing";
    order.payment = {
      method: "UPI",
      status: "Completed",
      razorpayOrderId,
      razorpayPaymentId,
    };

    await order.save();

    for (const item of order.items) {
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

    res.status(200).json({message: "Payment successful", order});
  } catch (error) {
    console.error("Error retrying payment:", error);
    res.status(500).json({message: "Failed to process payment"});
  }
};

// get order for user
const userOrders = async (req, res) => {
  try { 
    const userId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    // const order = await Order.find({user: userId}).sort({createdAt: -1});
    // return res.status(200).json({message: "Success", order});

    const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 }) 
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments({ user: userId });

  const totalPages = Math.ceil(totalOrders / limit);

  return res.status(200).json({
    message: "Success",
    orders,
    currentPage: page,
    totalPages,
    totalOrders,
  });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

// get all order for admin
const allOrderDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // const totalCount = await Products.countDocuments({});
    // const orders = await Order.find()
    //   .populate("user", "firstName lastName email")
    //   .sort({createdAt: -1})
    //   .skip(skip)
    //   .limit(limit);

    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    let filter = {};

    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: fromDate,
        $lte: toDate,
      };
    } else if (fromDate) {
      filter.createdAt = {$gte: fromDate};
    } else if (toDate) {
      filter.createdAt = {$lte: toDate};
    }

    const totalCount = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate("user", "firstName lastName email")
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "success",
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount: totalCount,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

//get order By  Id
const getOrderById = async (req, res) => {
  try {
    const {orderId} = req.params;
    const order = await Order.findById(orderId).populate(
      "user",
      "firstName lastName email phoneNumber"
    );
    if (!order) {
      return res.status(404).json({message: "Order not found"});
    }

    return res.status(200).json({message: "Success", order});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const {orderId} = req.params;
    const {orderStatus, paymentStatus} = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({message: "Order not found"});
    }

    if (order.status === "Cancelled") {
      return res
        .status(400)
        .json({message: "Order is already cancelled and cannot be updated"});
    }

    if (orderStatus) {
      if (!order.schema.path("status").enumValues.includes(orderStatus)) {
        return res.status(400).json({message: "Invalid order status"});
      }
      order.status = orderStatus;
    }

    if (paymentStatus) {
      if (
        !order.schema.path("payment.status").enumValues.includes(paymentStatus)
      ) {
        return res.status(400).json({message: "Invalid payment status"});
      }
      order.payment.status = paymentStatus;
    }

    const updatedOrder = await order.save();
    res.status(200).json({
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: "Failed to update order status"});
  }
};

const updateOrderItemStatus = async (req, res) => {
  const {orderId, productId} = req.params;
  const {status} = req.body;
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({message: "Order not found"});
    }

    console.log("this is from the updateOrderItemStatus order", order);
    const orderItem = order.items.find(
      (item) => item.product.toString() === productId
    );

    if (!orderItem) {
      return res.status(404).json({message: "Order item not found"});
    }

    const {quantity, size, price} = orderItem;

    const update = {
      "items.$.status": status,
    };

    switch (status) {
      case "Cancelled":
        update["items.$.cancelledAt"] = new Date();
        break;
      case "Delivered":
        update["items.$.Delivered"] = new Date();
        break;
      case "Return Requested":
        update["items.$.returnRequestedAt"] = new Date();
        break;
      case "Returned":
        update["items.$.returnedAt"] = new Date();
        break;
      case "Return Accepted":
        update["items.$.returnAcceptedAt"] = new Date();
        break;
      case "Return Rejected":
        update["items.$.returnRejectedAt"] = new Date();
        break;
      default:
        break;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      {_id: orderId, "items.product": productId},
      {$set: update},
      {new: true}
    );

    if (status === "Cancelled" || status === "Return Accepted") {
      const product = await Products.findById(productId);
      if (!product) {
        return res.status(404).json({message: "Product not found"});
      }

      product.stock += quantity;

      const sizeIndex = product.sizes.findIndex((s) => s.size === size);
      if (sizeIndex === -1) {
        return {status: 404, message: "Size not found"};
      }

      product.sizes[sizeIndex].stock += quantity;
      await product.save();

      const userId = order.user;
      const refundAmount = price * quantity;

      let wallet = await Wallet.findOne({user: userId});
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: refundAmount,
          transactions: [
            {
              type: "Refund",
              amount: refundAmount,
              description: `Refund for cancelled product ${product.productName}`,
            },
          ],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "Refund",
          amount: refundAmount,
          description: `Refund for cancelled product ${product.productName}`,
        });
      }
      await wallet.save();
    }

    if (!updatedOrder) {
      return res.status(404).json({message: "Order or Product not found"});
    }

    res
      .status(200)
      .json({message: "Order item status updated", order: updatedOrder});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const cancelOrder = async (req, res) => {
  try {
    const {orderId, productId} = req.body;

    const order = await Order.findById(orderId);
    console.log("this is the cancel order", order);

    if (!order) {
      return res.status(404).json({message: "Order not found"});
    }

    const item = order.items.find(
      (item) => item.product.toString() === productId
    );

    if (!item) {
      return res.status(404).json({message: "Product not found in the order"});
    }

    if (item.status !== "Active") {
      return res.status(400).json({message: "Item cannot be cancelled"});
    }

    item.status = "Cancelled";
    item.cancelledAt = new Date();

    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({message: "Product not found"});
    }

    product.stock += item.quantity;

    const sizeIndex = product.sizes.findIndex((s) => s.size === item.size);
    if (sizeIndex === -1) {
      return res.status(404).json({message: "Size not found"});
    }

    product.sizes[sizeIndex].stock += item.quantity;
    await product.save();

    if (order.payment.method !== "Cash on Delivery") {
      const refundAmount = item.price * item.quantity;
      const userId = order.user;

      let wallet = await Wallet.findOne({user: userId});
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: refundAmount,
          transactions: [
            {
              type: "Refund",
              amount: refundAmount,
              description: `Refund for cancelled product ${product.productName}`,
            },
          ],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "Refund",
          amount: refundAmount,
          description: `Refund for cancelled product ${product.productName}`,
        });
      }
      await wallet.save();
    } else {
      console.log("Payment was COD, no refund required.");
    }

    await order.save();

    return res
      .status(200)
      .json({message: "Product cancelled successfully", order});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const returnOrder = async (req, res) => {
  try {
    console.log("this is frm the return ordere", req.body);
    const {orderId, productId, reason} = req.body;

    const order = await Order.findOne({
      _id: orderId,
      "items.product": productId,
    });

    if (!order) {
      return res.status(404).json({message: "Order or product not found"});
    }

    const itemIndex = order.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({message: "Item not found in the order"});
    }

    order.items[itemIndex].status = "Return Requested";
    order.items[itemIndex].returnReason = reason;
    order.items[itemIndex].returnRequestedAt = new Date();

    await order.save();

    return res.status(200).json({message: "Return requested successfully"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const getOrderFullDetail = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
      user: userId
    })
      .populate({
        path: "items.product",
        populate: [
          { path: "brand" },
          { path: "offer" },
          {
            path: "category",
            model: "Category",
            populate: {
              path: "offer",
              model: "Offer",
            },
          },
        ],
      }) 
      .populate("user", "name email phone addresses");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Calculate offer prices for each item
    const itemsWithOffers = order.items.map(item => {
      const product = item.product;
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
        ...item.toObject(),
        product: {
          ...product.toObject(),
          ...priceDetails,
          offerValid: priceDetails.offerPercentage > 0,
        }
      };
    });

    // Calculate order totals
    const subtotal = itemsWithOffers.reduce((sum, item) => {
      const price = item.product.offerValid ? item.product.offerPrice : item.product.salePrice;
      return sum + (price * item.quantity);
    }, 0);

    const discount = order.coupon ? (subtotal * order.coupon.discountPercentage) / 100 : 0;
    const shippingCost = order.shippingCost || 0;
    const total = subtotal - discount + shippingCost;

    return res.status(200).json({
      message: "Order details fetched successfully",
      order: {
        ...order.toObject(),
        items: itemsWithOffers,
        totals: {
          subtotal,
          discount,
          shippingCost,
          total
        }
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to fetch order details" });
  }
};

const getOrderFullDetailAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    console.log("Fetching order:", orderId);

    const order = await Order.findById(orderId)
      .populate({
        path: "items.product",
        populate: [
          { path: "brand" },
          { path: "offer" },
          {
            path: "category",
            model: "Category",
            populate: {
              path: "offer",
              model: "Offer",
            },
          },
        ],
      })
      .populate("user", "firstName lastName email phoneNumber");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Order found:", order._id);

    // Calculate offer prices for each item
    const itemsWithOffers = order.items.map(item => {
      if (!item.product) {
        console.warn(`Product not found for item in order ${orderId}`);
        return {
          ...item.toObject(),
          product: item.product,
          offerValid: false
        };
      }

      const product = item.product;
      const productOffer = product?.offer?.discountPercentage || 0;
      const categoryOffer = product?.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product?.offer?.endDate || product?.category?.offer?.endDate;

      console.log(`Calculating offers for product ${product._id}:`, {
        productOffer,
        categoryOffer,
        offerExpirationDate
      });

      const priceDetails = calculateOfferPrice(
        product.salePrice || product.price,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );

      return {
        ...item.toObject(),
        product: {
          ...product.toObject(),
          ...priceDetails,
          offerValid: priceDetails.offerPercentage > 0,
        }
      };
    });

    // Calculate order totals
    const subtotal = itemsWithOffers.reduce((sum, item) => {
      if (!item.product) return sum;
      const price = item.product.offerValid ? item.product.offerPrice : (item.product.salePrice || item.product.price);
      return sum + (price * item.quantity);
    }, 0);

    const discount = order.couponDiscount || 0;
    const shippingCost = order.deliveryCharge || 0;
    const total = subtotal - discount + shippingCost;

    console.log("Order totals calculated:", { subtotal, discount, shippingCost, total });

    return res.status(200).json({
      message: "Order details fetched successfully",
      order: {
        ...order.toObject(),
        items: itemsWithOffers,
        totals: {
          subtotal,
          discount,
          shippingCost,
          total
        }
      }
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res.status(500).json({ 
      message: "Failed to fetch order details",
      error: error.message 
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    console.log("Request URL:", req.originalUrl);  // Log full URL for debugging
    console.log("Request Parameters:", req.params); // Log params to check structure

    const { orderId } = req.params;
    console.log("orderId", orderId);
    const order = await Order.findById(orderId)
      .populate("user items.product")
      .select("-password")
      .exec();
    const doc = new PDFDocument({margin: 50, size: "A4"});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${order._id}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(20).text("GharSofa", {align: "center"});
    doc.moveDown();
    doc.fontSize(16).text(`Invoice #${order._id}`, {align: "center"});
    doc.moveDown();

    doc.fontSize(12).text("Customer Details:", {underline: true});
    doc.text(`Name: ${order.user.firstName} ${order.user.lastName}`);
    doc.text(`Email: ${order.user.email}`);
    doc.text(`Phone: ${order.user.phoneNumber}`);
    doc.moveDown();

    doc.text("Shipping Address:", {underline: true});
    doc.text(`${order.address.customerName}`);
    doc.text(
      `${order.address.address}, ${order.address.locality}, ${order.address.city}`
    );
    doc.text(`${order.address.state} - ${order.address.pinCode}`);
    doc.text(`Type of Place: ${order.address.typeofPlace}`);
    doc.moveDown();

    doc.fontSize(12).text("Order Summary:", {underline: true});
    doc.text(`Total Price: Rs: ${order.totalPrice}`);
    doc.text(`Discount: Rs: ${order.couponDiscount || 0}`);
    doc.text(`Final Price: Rs: ${order.finalPrice}`);
    doc.text(`Delivery Charge: Rs: ${order.deliveryCharge}`);
    doc.text(`Payment Method: ${order.payment.method}`);
    doc.text(`Payment Status: ${order.payment.status}`);
    doc.moveDown();

    const tableHeaders = ["Product Name", "Brand", "Quantity", "Price (INR)"];
    const columnWidths = [200, 100, 100, 100];

    let startY = doc.y + 20;

    doc.fontSize(12).font("Helvetica-Bold");

    tableHeaders.forEach((header, i) => {
      doc.text(
        header,
        50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0),
        startY,
        {
          width: columnWidths[i],
          align: i === 3 ? "right" : "left",
        }
      );
    });

    doc.font("Helvetica");
    order.items.forEach((item, rowIndex) => {
      startY += 20;
      const row = [
        item.productName,
        item.productBrand,
        item.quantity.toString(),
        `Rs: ${item.totalPrice}`,
      ];

      row.forEach((cell, cellIndex) => {
        doc.text(
          cell,
          50 + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0),
          startY,
          {
            width: columnWidths[cellIndex],
            align: cellIndex === 3 ? "right" : "left",
          }
        );
      });
    });

    doc.moveDown(2);
    doc.end();
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const requestAssemblyService = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
      user: userId
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.items.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    // Check if item requires assembly
    if (!item.assemblyRequired) {
      return res.status(400).json({ message: "This item does not require assembly" });
    }

    // Check if assembly is already requested
    if (item.assemblyStatus === "Requested") {
      return res.status(400).json({ message: "Assembly service already requested for this item" });
    }

    // Update assembly status
    item.assemblyStatus = "Requested";
    item.assemblyRequestedAt = new Date();

    await order.save();

    return res.status(200).json({
      message: "Assembly service requested successfully",
      order
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to request assembly service" });
  }
};

const scheduleDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryDate, timeSlot, specialInstructions } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!deliveryDate || !timeSlot) {
      return res.status(400).json({ message: "Delivery date and time slot are required" });
    }

    // Validate delivery date is in the future
    const selectedDate = new Date(deliveryDate);
    if (selectedDate < new Date()) {
      return res.status(400).json({ message: "Delivery date must be in the future" });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if delivery is already scheduled
    if (order.delivery && order.delivery.scheduledDate) {
      return res.status(400).json({ message: "Delivery is already scheduled for this order" });
    }

    // Update delivery information
    order.delivery = {
      scheduledDate: deliveryDate,
      timeSlot: timeSlot,
      specialInstructions: specialInstructions || "",
      status: "Scheduled",
      updatedAt: new Date()
    };

    await order.save();

    return res.status(200).json({
      message: "Delivery scheduled successfully",
      order
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to schedule delivery" });
  }
};

const updateAssemblyStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { assemblyStatus, notes } = req.body;

    // Validate assembly status
    const validStatuses = ['Pending', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(assemblyStatus)) {
      return res.status(400).json({ 
        message: "Invalid assembly status. Must be one of: " + validStatuses.join(', ') 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.items.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    // Check if item requires assembly
    if (!item.assemblyRequired) {
      return res.status(400).json({ message: "This item does not require assembly" });
    }

    // Update assembly status
    item.assemblyStatus = assemblyStatus;
    item.assemblyNotes = notes || item.assemblyNotes;
    item.assemblyUpdatedAt = new Date();

    // Add status-specific timestamps
    switch (assemblyStatus) {
      case 'Scheduled':
        item.assemblyScheduledAt = new Date();
        break;
      case 'In Progress':
        item.assemblyStartedAt = new Date();
        break;
      case 'Completed':
        item.assemblyCompletedAt = new Date();
        break;
      case 'Cancelled':
        item.assemblyCancelledAt = new Date();
        break;
    }

    await order.save();

    return res.status(200).json({
      message: "Assembly status updated successfully",
      order
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to update assembly status" });
  }
};

export {
  createOrder,
  userOrders,
  allOrderDetails,
  getOrderById,
  updateOrderStatus,
  updateOrderItemStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
  cancelOrder,
  returnOrder,
  downloadInvoice,
  getOrderFullDetail,
  getOrderFullDetailAdmin,
  handlePaymentFailure,
  retryPayment,
  requestAssemblyService,
  scheduleDelivery,
  updateAssemblyStatus
};
