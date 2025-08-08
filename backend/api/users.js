// backend/api/users.js

const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        monthlyBudget: user.monthlyBudget,
        currency: user.currency,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, monthlyBudget, currency } = req.body;
    
    // Validate input
    const updates = {};
    if (firstName) updates.firstName = firstName.trim();
    if (lastName) updates.lastName = lastName.trim();
    if (monthlyBudget !== undefined) {
      if (monthlyBudget < 0) {
        return res.status(400).json({ message: 'Monthly budget cannot be negative' });
      }
      updates.monthlyBudget = monthlyBudget;
    }
    if (currency) updates.currency = currency;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        monthlyBudget: user.monthlyBudget,
        currency: user.currency,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update monthly budget (separate endpoint for convenience)
router.put('/budget', auth, async (req, res) => {
  try {
    const { monthlyBudget } = req.body;
    
    if (monthlyBudget === undefined || monthlyBudget < 0) {
      return res.status(400).json({ message: 'Valid monthly budget is required' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { monthlyBudget },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Budget updated successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        monthlyBudget: user.monthlyBudget,
        currency: user.currency
      }
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get total transactions count
    const totalTransactions = await Transaction.countDocuments({ userId });
    
    // Get total income and expenses (all time)
    const allTimeStats = await Transaction.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyStats = await Transaction.aggregate([
      { 
        $match: { 
          userId: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get category breakdown for current month
    const categoryStats = await Transaction.aggregate([
      { 
        $match: { 
          userId: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: { category: '$category', type: '$type' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    // Get recent transaction dates for streak calculation
    const recentDates = await Transaction.find(
      { userId },
      { date: 1 },
      { sort: { date: -1 }, limit: 30 }
    );

    // Format response
    const allTimeIncome = allTimeStats.find(s => s._id === 'income')?.total || 0;
    const allTimeExpenses = allTimeStats.find(s => s._id === 'expense')?.total || 0;
    const monthlyIncome = monthlyStats.find(s => s._id === 'income')?.total || 0;
    const monthlyExpenses = monthlyStats.find(s => s._id === 'expense')?.total || 0;

    // Calculate streak (days with transactions)
    const uniqueDates = [...new Set(recentDates.map(t => t.date.toDateString()))];
    let streak = 0;
    const today = new Date().toDateString();
    let currentDate = new Date();
    
    for (let i = 0; i < 30; i++) {
      const dateStr = currentDate.toDateString();
      if (uniqueDates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    res.json({
      totalTransactions,
      allTime: {
        income: allTimeIncome,
        expenses: allTimeExpenses,
        netWorth: allTimeIncome - allTimeExpenses
      },
      thisMonth: {
        income: monthlyIncome,
        expenses: monthlyExpenses,
        netBalance: monthlyIncome - monthlyExpenses,
        transactionCount: monthlyStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      categoryBreakdown: categoryStats.reduce((acc, stat) => {
        const category = stat._id.category;
        if (!acc[category]) {
          acc[category] = { income: 0, expenses: 0, total: 0 };
        }
        if (stat._id.type === 'income') {
          acc[category].income = stat.total;
        } else {
          acc[category].expenses = stat.total;
        }
        acc[category].total += stat.total;
        return acc;
      }, {}),
      streak,
      accountAge: Math.floor((Date.now() - req.user.createdAt) / (1000 * 60 * 60 * 24))
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user account (with all associated data)
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }

    // Verify password
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Delete all user transactions
    await Transaction.deleteMany({ userId: req.user._id });
    
    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({ message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user preferences/settings
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      currency: user.currency || 'USD',
      monthlyBudget: user.monthlyBudget || 5000,
      // Add more preferences as needed
      dateFormat: 'MM/DD/YYYY', // Default
      theme: 'light' // Default
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const { currency, dateFormat, theme } = req.body;
    
    const updates = {};
    if (currency) updates.currency = currency;
    // Note: dateFormat and theme would need to be added to User model
    // For now, we'll just handle currency
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Preferences updated successfully',
      preferences: {
        currency: user.currency,
        monthlyBudget: user.monthlyBudget,
        dateFormat: dateFormat || 'MM/DD/YYYY',
        theme: theme || 'light'
      }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;