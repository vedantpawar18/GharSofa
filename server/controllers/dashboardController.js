import Products from "../models/productModel.js";
import Order from "../models/orderModel.js";
import {
  startOfDay,
  subDays,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from "date-fns";

const dashboardStatus = async (req, res) => {
  try {
    const now = new Date();

    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentMonthStats = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          createdAt: {$gte: firstDayCurrentMonth, $lte: lastDayCurrentMonth},
        },
      },
      {
        $group: {
          _id: null,
          totalSales: {$sum: {$sum: "$items.quantity"}},
          totalOrders: {$sum: 1},
          totalRevenue: {$sum: "$finalPrice"},
          totalProductsSold: {$sum: {$size: "$items"}},
        },
      },
    ]);

    const lastMonthStats = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          createdAt: {$gte: firstDayLastMonth, $lte: lastDayLastMonth},
        },
      },
      {
        $group: {
          _id: null,
          totalSales: {$sum: {$sum: "$items.quantity"}},
          totalOrders: {$sum: 1},
          totalRevenue: {$sum: "$finalPrice"},
          totalProductsSold: {$sum: {$size: "$items"}},
        },
      },
    ]);

    const totalProducts = await Products.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        totalSales: currentMonthStats[0]?.totalSales || 0,
        totalOrders: currentMonthStats[0]?.totalOrders || 0,
        totalProductsSold: currentMonthStats[0]?.totalProductsSold || 0,
        totalRevenue: currentMonthStats[0]?.totalRevenue || 0,
        totalProducts: totalProducts || 0,
        lastMonthSales: lastMonthStats[0]?.totalSales || 0,
        lastMonthOrders: lastMonthStats[0]?.totalOrders || 0,
        lastMonthProductsSold: lastMonthStats[0]?.totalProductsSold || 0,
        lastMonthRevenue: lastMonthStats[0]?.totalRevenue || 0,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const salesChart = async (req, res) => {
  try {
    const {period} = req.query;
    const now = new Date();
    let startDate, groupBy, dateFormat;

    switch (period) {
      case "WEEKLY":
        startDate = startOfWeek(subDays(now, 7 * 7));
        groupBy = {$dateToString: {format: "%Y-%m-%d", date: "$createdAt"}};
        dateFormat = "%m/%d";
        break;
      case "MONTHLY":
        startDate = startOfMonth(subDays(now, 30 * 6));
        groupBy = {$dateToString: {format: "%Y-%m", date: "$createdAt"}};
        dateFormat = "%b";
        break;
      case "YEARLY":
        startDate = startOfYear(subDays(now, 365 * 5));
        groupBy = {$dateToString: {format: "%Y", date: "$createdAt"}};
        dateFormat = "%Y";
        break;
      default:
        return res.status(400).json({error: "Invalid period"});
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: {$gte: startDate},
          status: {$nin: ["Cancelled", "Returned"]},
        },
      },
      {
        $group: {
          _id: groupBy,
          sales: {$sum: "$finalPrice"},
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          sales: 1,
        },
      },
      {$sort: {date: 1}},
    ]);

    // console.log("this is the result of chart ", salesData)

    return res.status(200).json(salesData);
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const getBestItems = async (req, res) => {
  try {
    //this is for top products
    const topProducts = await Order.aggregate([
      {$unwind: "$items"},
      {
        $group: {
          _id: "$items.product",
          totalSales: {$sum: "$items.quantity"},
        },
      },
      {$sort: {totalSales: -1}},
      {$limit: 10},
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {$unwind: "$productDetails"},
      {
        $project: {
          _id: 0,
          productId: "$_id",
          totalSales: 1,
          productName: "$productDetails.productName",
          thumbnail: "$productDetails.thumbnail",
          category: "$productDetails.category",
          brand: "$productDetails.brand",
          salePrice: "$productDetails.salePrice",
        },
      },
    ]);

    //this is for the top brands
    const topBrands = await Order.aggregate([
      {$unwind: "$items"},
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {$unwind: "$productDetails"},
      {
        $group: {
          _id: "$productDetails.brand",
          totalSales: {$sum: "$items.quantity"},
        },
      },
      {$sort: {totalSales: -1}},
      {$limit: 10},
      {
        $lookup: {
          from: "brands",
          localField: "_id",
          foreignField: "_id",
          as: "brandDetails",
        },
      },
      {$unwind: "$brandDetails"},
      {
        $project: {
          _id: 0,
          brandId: "$_id",
          totalSales: 1,
          brandName: "$brandDetails.brandName",
          logo: "$brandDetails.logo",
        },
      },
    ]);

    //this is for the top categorys
    const topCategories = await Order.aggregate([
      {$unwind: "$items"},
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {$unwind: "$productDetails"},
      {
        $group: {
          _id: "$productDetails.category",
          totalSales: {$sum: "$items.quantity"},
        },
      },
      {$sort: {totalSales: -1}},
      {$limit: 10},
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {$unwind: "$categoryDetails"},
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          totalSales: 1,
          categoryName: "$categoryDetails.categoryName",
          description: "$categoryDetails.description",
          status: "$categoryDetails.status",
        },
      },
    ]);

    return res
      .status(200)
      .json({message: "Success", topProducts, topBrands, topCategories});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

export {dashboardStatus, salesChart, getBestItems};
