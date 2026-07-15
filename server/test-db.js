import mongoose from 'mongoose';
import Token from './models/Token.js';
import Service from './models/Service.js';
import Counter from './models/Counter.js';
import CounterStaff from './models/CounterStaff.js';
import Branch from './models/Branch.js';

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/smart_queue');
    console.log('Connected to MongoDB');

    const timeframe = '30days'; // testing with 30 days
    const now = new Date();
    let startDate = new Date();
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const currentFilter = { arrivalTime: { $gte: startDate, $lte: endDate } };

    // Daily Queue Trend
    const dailyAgg = await Token.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%b %d", date: "$arrivalTime", timezone: "Asia/Kolkata" } },
          issued: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    const dailyTrend = dailyAgg.map(d => ({
      date: d._id,
      issued: d.issued,
      completed: d.completed
    }));

    console.log('Daily Trend (30 days):', dailyTrend);

    // Hourly peak-hour Aggregate
    const hourlyAgg = await Token.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: { $hour: { date: "$arrivalTime", timezone: "Asia/Kolkata" } },
          issued: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const hourlyCounts = Array.from({ length: 9 }, (_, i) => {
      const hourNum = i + 9;
      const match = hourlyAgg.find(h => h._id === hourNum);
      return {
        hour: `${hourNum % 12 || 12} ${hourNum >= 12 ? 'PM' : 'AM'}`,
        issued: match ? match.issued : 0,
        completed: match ? match.completed : 0
      };
    });

    console.log('Hourly counts (30 days) from 9AM to 5PM:', hourlyCounts);
    console.log('Hourly aggregation raw result:', hourlyAgg);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
