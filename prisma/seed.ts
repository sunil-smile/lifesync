import {
  PrismaClient,
  Frequency,
  WorkoutType,
  IntensityLevel,
  InvestmentPlatform,
  TaskPriority,
  TaskStatus,
  GoalType,
  GoalStatus,
  NoteVisibility,
  ProgressType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── 1. Delete all existing data in reverse dependency order ──────────────

  console.log('🗑️  Deleting existing data...');

  await prisma.xpLog.deleteMany({});
  await prisma.bankUploadLog.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.timeEntry.deleteMany({});
  await prisma.milestone.deleteMany({});

  // Reset goalId on tasks before deleting goals
  await prisma.task.updateMany({ data: { goalId: null } });
  await prisma.task.deleteMany({});
  await prisma.goal.deleteMany({});

  await prisma.investment.deleteMany({});
  await prisma.budgetCategory.deleteMany({});
  await prisma.income.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.sleepLog.deleteMany({});
  await prisma.workout.deleteMany({});
  await prisma.habitLog.deleteMany({});
  await prisma.habit.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Existing data deleted.');

  // ─── 2. Create Users ───────────────────────────────────────────────────────

  console.log('👤 Creating users...');

  const sunilPassword = await bcrypt.hash('sunil123', 12);
  const vidhyaPassword = await bcrypt.hash('vidhya123', 12);

  const sunil = await prisma.user.create({
    data: {
      name: 'Sunil',
      email: 'sunil@lifesync.app',
      password: sunilPassword,
      bankName: 'ABN AMRO',
      xp: 2685,
      level: 7,
      levelName: 'Consistent Achiever',
      avatar: 'S',
    },
  });

  const vidhya = await prisma.user.create({
    data: {
      name: 'Vidhya',
      email: 'vidhya@lifesync.app',
      password: vidhyaPassword,
      bankName: 'ING Bank',
      xp: 1890,
      level: 6,
      levelName: 'Determined',
      avatar: 'V',
    },
  });

  console.log(`✅ Users created: ${sunil.name}, ${vidhya.name}`);

  // ─── 3. Create Habits ──────────────────────────────────────────────────────

  console.log('🏃 Creating habits...');

  const morningRun = await prisma.habit.create({
    data: {
      name: 'Morning Run',
      icon: '🏃',
      color: '#3B82F6',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: sunil.id,
    },
  });

  const meditate = await prisma.habit.create({
    data: {
      name: 'Meditate',
      icon: '🧘',
      color: '#8B5CF6',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: sunil.id,
    },
  });

  const read30 = await prisma.habit.create({
    data: {
      name: 'Read 30 min',
      icon: '📖',
      color: '#F59E0B',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: sunil.id,
    },
  });

  const water2L = await prisma.habit.create({
    data: {
      name: 'Drink 2L Water',
      icon: '💧',
      color: '#06B6D4',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: sunil.id,
    },
  });

  const yoga = await prisma.habit.create({
    data: {
      name: 'Yoga',
      icon: '🤸',
      color: '#EC4899',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: vidhya.id,
    },
  });

  const journaling = await prisma.habit.create({
    data: {
      name: 'Journaling',
      icon: '✍️',
      color: '#10B981',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: vidhya.id,
    },
  });

  const eveningWalk = await prisma.habit.create({
    data: {
      name: 'Evening Walk',
      icon: '🚶',
      color: '#6366F1',
      frequency: Frequency.DAILY,
      targetDays: 7,
      userId: vidhya.id,
    },
  });

  console.log('✅ Habits created.');

  // ─── 4. Create HabitLogs for last 14 days ─────────────────────────────────

  console.log('📅 Creating habit logs...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function daysAgo(n: number): Date {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  }

  // Sunil - Morning Run: completed all except days 5 and 11 back
  const morningRunSkipped = new Set([5, 11]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: morningRun.id,
        userId: sunil.id,
        date: daysAgo(i),
        completed: !morningRunSkipped.has(i),
      },
    });
  }

  // Sunil - Meditate: completed all except day 8 back
  const meditateSkipped = new Set([8]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: meditate.id,
        userId: sunil.id,
        date: daysAgo(i),
        completed: !meditateSkipped.has(i),
      },
    });
  }

  // Sunil - Read 30 min: completed except days 4, 9, 13 back
  const readSkipped = new Set([4, 9, 13]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: read30.id,
        userId: sunil.id,
        date: daysAgo(i),
        completed: !readSkipped.has(i),
      },
    });
  }

  // Sunil - Water: completed except days 3, 7, 12 back
  const waterSkipped = new Set([3, 7, 12]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: water2L.id,
        userId: sunil.id,
        date: daysAgo(i),
        completed: !waterSkipped.has(i),
      },
    });
  }

  // Vidhya - Yoga: completed all except day 6 back
  const yogaSkipped = new Set([6]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: yoga.id,
        userId: vidhya.id,
        date: daysAgo(i),
        completed: !yogaSkipped.has(i),
      },
    });
  }

  // Vidhya - Journaling: completed except days 5, 10 back
  const journalingSkipped = new Set([5, 10]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: journaling.id,
        userId: vidhya.id,
        date: daysAgo(i),
        completed: !journalingSkipped.has(i),
      },
    });
  }

  // Vidhya - Evening Walk: completed except days 4, 8, 13 back
  const walkSkipped = new Set([4, 8, 13]);
  for (let i = 0; i < 14; i++) {
    await prisma.habitLog.create({
      data: {
        habitId: eveningWalk.id,
        userId: vidhya.id,
        date: daysAgo(i),
        completed: !walkSkipped.has(i),
      },
    });
  }

  console.log('✅ Habit logs created.');

  // ─── 5. Create Workouts ────────────────────────────────────────────────────

  console.log('💪 Creating workouts...');

  await prisma.workout.create({
    data: {
      userId: sunil.id,
      name: 'Morning Run 6km',
      type: WorkoutType.RUNNING,
      durationMinutes: 45,
      distanceKm: 6.2,
      intensityLevel: IntensityLevel.MEDIUM,
      caloriesBurned: 380,
      loggedAt: daysAgo(3),
    },
  });

  await prisma.workout.create({
    data: {
      userId: sunil.id,
      name: 'Strength Training',
      type: WorkoutType.GYM,
      durationMinutes: 60,
      intensityLevel: IntensityLevel.HIGH,
      caloriesBurned: 420,
      loggedAt: daysAgo(6),
    },
  });

  await prisma.workout.create({
    data: {
      userId: sunil.id,
      name: 'Weekend Ride',
      type: WorkoutType.CYCLING,
      durationMinutes: 90,
      distanceKm: 28,
      intensityLevel: IntensityLevel.HIGH,
      caloriesBurned: 650,
      loggedAt: daysAgo(9),
    },
  });

  await prisma.workout.create({
    data: {
      userId: sunil.id,
      name: 'Easy Run',
      type: WorkoutType.RUNNING,
      durationMinutes: 30,
      distanceKm: 4,
      intensityLevel: IntensityLevel.LOW,
      caloriesBurned: 220,
      loggedAt: daysAgo(12),
    },
  });

  await prisma.workout.create({
    data: {
      userId: vidhya.id,
      name: 'Morning Flow',
      type: WorkoutType.YOGA,
      durationMinutes: 45,
      intensityLevel: IntensityLevel.LOW,
      caloriesBurned: 150,
      loggedAt: daysAgo(2),
    },
  });

  await prisma.workout.create({
    data: {
      userId: vidhya.id,
      name: 'Vinyasa Flow',
      type: WorkoutType.YOGA,
      durationMinutes: 60,
      intensityLevel: IntensityLevel.MEDIUM,
      caloriesBurned: 220,
      loggedAt: daysAgo(7),
    },
  });

  console.log('✅ Workouts created.');

  // ─── 6. Create SleepLogs ──────────────────────────────────────────────────

  console.log('😴 Creating sleep logs...');

  // Sleep quality varies per night: 3–5 stars, hours 7.0–8.5
  const sunilSleepData = [
    { daysBack: 1, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 2, bedHour: 22, bedMin: 45, hours: 8.0, quality: 5 },
    { daysBack: 3, bedHour: 23, bedMin: 0, hours: 7.0, quality: 3 },
    { daysBack: 4, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 5, bedHour: 22, bedMin: 15, hours: 8.5, quality: 5 },
    { daysBack: 6, bedHour: 23, bedMin: 30, hours: 7.0, quality: 3 },
    { daysBack: 7, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 8, bedHour: 22, bedMin: 0, hours: 8.0, quality: 5 },
    { daysBack: 9, bedHour: 23, bedMin: 15, hours: 7.0, quality: 3 },
    { daysBack: 10, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 11, bedHour: 22, bedMin: 45, hours: 8.0, quality: 4 },
    { daysBack: 12, bedHour: 23, bedMin: 0, hours: 7.0, quality: 3 },
    { daysBack: 13, bedHour: 22, bedMin: 30, hours: 8.0, quality: 5 },
    { daysBack: 14, bedHour: 22, bedMin: 15, hours: 7.5, quality: 4 },
  ];

  for (const s of sunilSleepData) {
    const bedtime = new Date(daysAgo(s.daysBack));
    bedtime.setHours(s.bedHour, s.bedMin, 0, 0);
    const wakeTime = new Date(bedtime);
    wakeTime.setTime(wakeTime.getTime() + s.hours * 60 * 60 * 1000);

    await prisma.sleepLog.create({
      data: {
        userId: sunil.id,
        bedtime,
        wakeTime,
        totalHours: s.hours,
        qualityRating: s.quality,
        loggedAt: daysAgo(s.daysBack - 1),
      },
    });
  }

  const vidhyaSleepData = [
    { daysBack: 1, bedHour: 22, bedMin: 0, hours: 8.0, quality: 5 },
    { daysBack: 2, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 3, bedHour: 22, bedMin: 15, hours: 8.0, quality: 5 },
    { daysBack: 4, bedHour: 23, bedMin: 0, hours: 7.0, quality: 3 },
    { daysBack: 5, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 6, bedHour: 22, bedMin: 0, hours: 8.5, quality: 5 },
    { daysBack: 7, bedHour: 23, bedMin: 15, hours: 7.0, quality: 3 },
    { daysBack: 8, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 9, bedHour: 22, bedMin: 45, hours: 8.0, quality: 4 },
    { daysBack: 10, bedHour: 22, bedMin: 0, hours: 8.0, quality: 5 },
    { daysBack: 11, bedHour: 23, bedMin: 0, hours: 7.0, quality: 3 },
    { daysBack: 12, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
    { daysBack: 13, bedHour: 22, bedMin: 15, hours: 8.0, quality: 5 },
    { daysBack: 14, bedHour: 22, bedMin: 30, hours: 7.5, quality: 4 },
  ];

  for (const s of vidhyaSleepData) {
    const bedtime = new Date(daysAgo(s.daysBack));
    bedtime.setHours(s.bedHour, s.bedMin, 0, 0);
    const wakeTime = new Date(bedtime);
    wakeTime.setTime(wakeTime.getTime() + s.hours * 60 * 60 * 1000);

    await prisma.sleepLog.create({
      data: {
        userId: vidhya.id,
        bedtime,
        wakeTime,
        totalHours: s.hours,
        qualityRating: s.quality,
        loggedAt: daysAgo(s.daysBack - 1),
      },
    });
  }

  console.log('✅ Sleep logs created.');

  // ─── 7. Create Expenses ────────────────────────────────────────────────────

  console.log('💸 Creating expenses...');

  const currentMonth = new Date();
  function thisMonthDay(day: number): Date {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
  }

  const expenses = [
    {
      amount: 85.5,
      category: 'Food & Dining',
      description: 'Albert Heijn weekly groceries',
      date: thisMonthDay(1),
      paidBy: 'Sunil',
    },
    {
      amount: 42.0,
      category: 'Food & Dining',
      description: 'Dinner at Restaurant Blauw',
      date: thisMonthDay(2),
      paidBy: 'both',
    },
    {
      amount: 35.0,
      category: 'Transport',
      description: 'NS Monthly OV Card top-up',
      date: thisMonthDay(2),
      paidBy: 'Sunil',
    },
    {
      amount: 12.5,
      category: 'Food & Dining',
      description: 'Lunch at Subway',
      date: thisMonthDay(3),
      paidBy: 'Sunil',
    },
    {
      amount: 55.0,
      category: 'Health',
      description: 'Gym membership',
      date: thisMonthDay(4),
      paidBy: 'Sunil',
    },
    {
      amount: 45.0,
      category: 'Health',
      description: 'Yoga studio monthly fee',
      date: thisMonthDay(4),
      paidBy: 'Vidhya',
    },
    {
      amount: 18.99,
      category: 'Entertainment',
      description: 'Netflix subscription',
      date: thisMonthDay(5),
      paidBy: 'both',
    },
    {
      amount: 92.0,
      category: 'Food & Dining',
      description: 'Albert Heijn weekly groceries',
      date: thisMonthDay(7),
      paidBy: 'Vidhya',
    },
    {
      amount: 15.0,
      category: 'Transport',
      description: 'Taxi home from airport',
      date: thisMonthDay(8),
      paidBy: 'Sunil',
    },
    {
      amount: 120.0,
      category: 'Shopping',
      description: 'Running shoes at Decathlon',
      date: thisMonthDay(9),
      paidBy: 'Sunil',
    },
    {
      amount: 89.99,
      category: 'Utilities',
      description: 'Electricity bill',
      date: thisMonthDay(10),
      paidBy: 'both',
    },
    {
      amount: 42.5,
      category: 'Food & Dining',
      description: 'Indian restaurant Tulsi',
      date: thisMonthDay(11),
      paidBy: 'both',
    },
    {
      amount: 65.0,
      category: 'Shopping',
      description: 'Books from Bol.com',
      date: thisMonthDay(12),
      paidBy: 'Sunil',
    },
    {
      amount: 78.5,
      category: 'Food & Dining',
      description: 'Albert Heijn weekly groceries',
      date: thisMonthDay(14),
      paidBy: 'Vidhya',
    },
    {
      amount: 25.0,
      category: 'Transport',
      description: 'Fuel for car',
      date: thisMonthDay(15),
      paidBy: 'Sunil',
    },
    {
      amount: 35.0,
      category: 'Entertainment',
      description: 'Cinema tickets',
      date: thisMonthDay(16),
      paidBy: 'both',
    },
    {
      amount: 145.0,
      category: 'Home',
      description: 'IKEA shelving unit',
      date: thisMonthDay(17),
      paidBy: 'both',
    },
    {
      amount: 22.5,
      category: 'Food & Dining',
      description: 'Coffee and cake at Bagels & Beans',
      date: thisMonthDay(18),
      paidBy: 'Vidhya',
    },
    {
      amount: 55.0,
      category: 'Utilities',
      description: 'Internet bill Ziggo',
      date: thisMonthDay(19),
      paidBy: 'both',
    },
    {
      amount: 38.0,
      category: 'Food & Dining',
      description: 'Takeaway Thai food',
      date: thisMonthDay(20),
      paidBy: 'Sunil',
    },
  ];

  for (const expense of expenses) {
    const userId =
      expense.paidBy === 'Vidhya' ? vidhya.id : sunil.id;
    await prisma.expense.create({
      data: {
        userId,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        date: expense.date,
        paidBy: expense.paidBy,
      },
    });
  }

  console.log('✅ Expenses created.');

  // ─── 8. Create Income ──────────────────────────────────────────────────────

  console.log('💰 Creating income...');

  const incomeMonth = new Date();

  await prisma.income.create({
    data: {
      userId: sunil.id,
      amount: 3800,
      source: 'Employer',
      category: 'Salary',
      date: new Date(incomeMonth.getFullYear(), incomeMonth.getMonth(), 25),
      receivedBy: 'Sunil',
      recurring: true,
      notes: 'Monthly salary from employer',
    },
  });

  await prisma.income.create({
    data: {
      userId: sunil.id,
      amount: 400,
      source: 'Freelance Client',
      category: 'Freelance',
      date: new Date(incomeMonth.getFullYear(), incomeMonth.getMonth(), 15),
      receivedBy: 'Sunil',
      recurring: false,
      notes: 'Web development project',
    },
  });

  await prisma.income.create({
    data: {
      userId: vidhya.id,
      amount: 2400,
      source: 'Employer',
      category: 'Salary',
      date: new Date(incomeMonth.getFullYear(), incomeMonth.getMonth(), 25),
      receivedBy: 'Vidhya',
      recurring: true,
      notes: 'Monthly salary from employer',
    },
  });

  console.log('✅ Income created.');

  // ─── 9. Create BudgetCategories ───────────────────────────────────────────

  console.log('📊 Creating budget categories...');

  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;

  const budgetCategories = [
    { name: 'Food & Dining', icon: '🍽️', monthlyLimit: 800, alertAt: 80 },
    { name: 'Transport', icon: '🚗', monthlyLimit: 350, alertAt: 80 },
    { name: 'Entertainment', icon: '🎬', monthlyLimit: 200, alertAt: 75 },
    { name: 'Utilities', icon: '⚡', monthlyLimit: 280, alertAt: 85 },
    { name: 'Health', icon: '💪', monthlyLimit: 200, alertAt: 80 },
    { name: 'Shopping', icon: '🛍️', monthlyLimit: 300, alertAt: 80 },
    { name: 'Home', icon: '🏠', monthlyLimit: 250, alertAt: 80 },
  ];

  for (const cat of budgetCategories) {
    await prisma.budgetCategory.create({
      data: {
        userId: sunil.id,
        name: cat.name,
        icon: cat.icon,
        monthlyLimit: cat.monthlyLimit,
        alertAt: cat.alertAt,
        month: currentMonthNum,
        year: currentYear,
      },
    });
  }

  console.log('✅ Budget categories created.');

  // ─── 10. Create Investments ───────────────────────────────────────────────

  console.log('📈 Creating investments...');

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Infosys',
      ticker: 'INFY',
      platform: InvestmentPlatform.INDIA_STOCK,
      sector: 'IT',
      units: 100,
      buyPrice: 1650,
      currentPrice: 1810,
      currency: 'INR',
      purchaseDate: new Date('2023-06-15'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'TCS',
      ticker: 'TCS',
      platform: InvestmentPlatform.INDIA_STOCK,
      sector: 'IT',
      units: 50,
      buyPrice: 3400,
      currentPrice: 3720,
      currency: 'INR',
      purchaseDate: new Date('2023-04-10'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'HDFC Bank',
      ticker: 'HDFCBANK',
      platform: InvestmentPlatform.INDIA_STOCK,
      sector: 'Banking',
      units: 200,
      buyPrice: 1520,
      currentPrice: 1620,
      currency: 'INR',
      purchaseDate: new Date('2023-01-20'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'ICICI Bank',
      ticker: 'ICICIBANK',
      platform: InvestmentPlatform.INDIA_STOCK,
      sector: 'Banking',
      units: 150,
      buyPrice: 980,
      currentPrice: 1045,
      currency: 'INR',
      purchaseDate: new Date('2022-11-05'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Sun Pharma',
      ticker: 'SUNPHARMA',
      platform: InvestmentPlatform.INDIA_STOCK,
      sector: 'Healthcare',
      units: 80,
      buyPrice: 1050,
      currentPrice: 1180,
      currency: 'INR',
      purchaseDate: new Date('2023-08-12'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Apple',
      ticker: 'AAPL',
      platform: InvestmentPlatform.US_STOCK,
      sector: 'Technology',
      units: 20,
      buyPrice: 165,
      currentPrice: 185,
      currency: 'USD',
      purchaseDate: new Date('2022-09-01'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Nvidia',
      ticker: 'NVDA',
      platform: InvestmentPlatform.US_STOCK,
      sector: 'Technology',
      units: 10,
      buyPrice: 450,
      currentPrice: 685,
      currency: 'USD',
      purchaseDate: new Date('2023-03-22'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Mirae Asset ELSS',
      platform: InvestmentPlatform.INDIA_MF,
      sector: 'Mutual Funds',
      fundType: 'ELSS',
      investedAmount: 50000,
      currentValue: 61500,
      currency: 'INR',
      purchaseDate: new Date('2022-04-01'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Axis Bluechip',
      platform: InvestmentPlatform.INDIA_MF,
      sector: 'Mutual Funds',
      fundType: 'Large Cap',
      investedAmount: 30000,
      currentValue: 34200,
      currency: 'INR',
      purchaseDate: new Date('2022-07-15'),
    },
  });

  await prisma.investment.create({
    data: {
      userId: sunil.id,
      name: 'Parag Parikh Flexi Cap',
      platform: InvestmentPlatform.INDIA_MF,
      sector: 'Mutual Funds',
      fundType: 'Flexi Cap',
      investedAmount: 25000,
      currentValue: 31000,
      currency: 'INR',
      purchaseDate: new Date('2023-01-10'),
    },
  });

  console.log('✅ Investments created.');

  // ─── 11. Create Tasks ─────────────────────────────────────────────────────

  console.log('✅ Creating tasks...');

  function daysFromNow(n: number): Date {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  }

  const fileQuarterlyTaxes = await prisma.task.create({
    data: {
      userId: sunil.id,
      title: 'File quarterly taxes',
      priority: TaskPriority.HIGH,
      assignee: 'Sunil',
      status: TaskStatus.TODO,
      dueDate: daysFromNow(0),
    },
  });

  const buyGroceries = await prisma.task.create({
    data: {
      userId: sunil.id,
      title: 'Buy groceries',
      priority: TaskPriority.MEDIUM,
      assignee: 'both',
      status: TaskStatus.TODO,
      dueDate: daysFromNow(0),
    },
  });

  await prisma.task.create({
    data: {
      userId: sunil.id,
      title: 'Call plumber',
      priority: TaskPriority.MEDIUM,
      assignee: 'Sunil',
      status: TaskStatus.TODO,
      dueDate: daysFromNow(3),
    },
  });

  await prisma.task.create({
    data: {
      userId: sunil.id,
      title: 'Book anniversary dinner',
      priority: TaskPriority.LOW,
      assignee: 'both',
      status: TaskStatus.TODO,
      dueDate: daysFromNow(5),
    },
  });

  await prisma.task.create({
    data: {
      userId: sunil.id,
      title: 'Renew car insurance',
      priority: TaskPriority.HIGH,
      assignee: 'Sunil',
      status: TaskStatus.TODO,
      dueDate: daysFromNow(8),
    },
  });

  await prisma.task.create({
    data: {
      userId: vidhya.id,
      title: 'Order birthday gift for mom',
      priority: TaskPriority.MEDIUM,
      assignee: 'Vidhya',
      status: TaskStatus.TODO,
      dueDate: daysFromNow(11),
    },
  });

  await prisma.task.create({
    data: {
      userId: sunil.id,
      title: 'Upload ABN AMRO transactions',
      priority: TaskPriority.HIGH,
      assignee: 'Sunil',
      status: TaskStatus.DONE,
      dueDate: daysFromNow(0),
    },
  });

  await prisma.task.create({
    data: {
      userId: vidhya.id,
      title: 'Schedule dentist appointment',
      priority: TaskPriority.MEDIUM,
      assignee: 'Vidhya',
      status: TaskStatus.DONE,
      dueDate: daysAgo(1),
    },
  });

  console.log('✅ Tasks created.');

  // ─── 12. Create Goals ─────────────────────────────────────────────────────

  console.log('🎯 Creating goals...');

  // Life Goals
  const financialFreedom = await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Achieve Financial Freedom',
      description: 'Build enough passive income to retire by 50 and live life on our own terms.',
      whyMotivation: 'Retire by 50, live on passive income, travel freely with Vidhya',
      type: GoalType.LIFE,
      category: 'Finance',
      assignee: 'Sunil',
      progress: 42,
      progressType: ProgressType.PERCENTAGE,
      status: GoalStatus.ACTIVE,
    },
  });

  const healthiestSelf = await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Be the Healthiest Version of Myself',
      description: 'Achieve peak physical and mental fitness through consistent habits.',
      whyMotivation: 'Strong body, clear mind, energy to be present for family',
      type: GoalType.LIFE,
      category: 'Health',
      assignee: 'Sunil',
      progress: 65,
      progressType: ProgressType.PERCENTAGE,
      status: GoalStatus.ACTIVE,
    },
  });

  // Long-term goals
  const portfolioGoal = await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Build €200K Investment Portfolio',
      description: 'Systematically grow investments to reach €200,000 total portfolio value.',
      type: GoalType.LONG_TERM,
      category: 'Finance',
      assignee: 'Sunil',
      progress: 35,
      progressType: ProgressType.PERCENTAGE,
      targetValue: 200000,
      targetUnit: 'EUR',
      targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 3)),
      parentGoalId: financialFreedom.id,
      status: GoalStatus.ACTIVE,
    },
  });

  const marathonGoal = await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Run a Full Marathon',
      description: 'Complete a full 42.2km marathon race.',
      type: GoalType.LONG_TERM,
      category: 'Health',
      assignee: 'Sunil',
      progress: 20,
      progressType: ProgressType.PERCENTAGE,
      targetDate: new Date(new Date().setMonth(new Date().getMonth() + 8)),
      parentGoalId: healthiestSelf.id,
      status: GoalStatus.ACTIVE,
    },
  });

  await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Pay Off Mortgage Early',
      description: 'Pay off the remaining mortgage 5 years ahead of schedule.',
      type: GoalType.LONG_TERM,
      category: 'Finance',
      assignee: 'both',
      progress: 60,
      progressType: ProgressType.PERCENTAGE,
      targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 4)),
      parentGoalId: financialFreedom.id,
      status: GoalStatus.ACTIVE,
    },
  });

  // Short-term goals
  const investMonthly = await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Invest €500/month for 6 months',
      description: 'Consistently invest at least €500 every month for 6 consecutive months.',
      type: GoalType.SHORT_TERM,
      category: 'Finance',
      assignee: 'Sunil',
      progress: 67,
      progressType: ProgressType.PERCENTAGE,
      targetDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      parentGoalId: portfolioGoal.id,
      status: GoalStatus.ACTIVE,
    },
  });

  await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Exercise 4x/week this quarter',
      description: 'Maintain at least 4 workout sessions every week for the entire quarter.',
      type: GoalType.SHORT_TERM,
      category: 'Health',
      assignee: 'Sunil',
      progress: 75,
      progressType: ProgressType.PERCENTAGE,
      targetDate: new Date(new Date().setMonth(new Date().getMonth() + 4)),
      parentGoalId: marathonGoal.id,
      status: GoalStatus.ACTIVE,
    },
  });

  await prisma.goal.create({
    data: {
      userId: sunil.id,
      title: 'Learn Tamil conversational level',
      description: 'Achieve conversational fluency in Tamil to better communicate with Vidhya\'s family.',
      whyMotivation: 'Connect better with Vidhya\'s family',
      type: GoalType.SHORT_TERM,
      category: 'Learning',
      assignee: 'Sunil',
      progress: 30,
      progressType: ProgressType.PERCENTAGE,
      targetDate: new Date(new Date().setMonth(new Date().getMonth() + 10)),
      status: GoalStatus.ACTIVE,
    },
  });

  console.log('✅ Goals created.');

  // ─── 13. Create Milestones ────────────────────────────────────────────────

  console.log('🏁 Creating milestones...');

  await prisma.milestone.create({
    data: {
      goalId: portfolioGoal.id,
      title: 'Open BUX + Zerodha accounts',
      completed: true,
    },
  });

  await prisma.milestone.create({
    data: {
      goalId: portfolioGoal.id,
      title: 'First €5,000 invested',
      completed: true,
    },
  });

  await prisma.milestone.create({
    data: {
      goalId: portfolioGoal.id,
      title: 'Reach €20,000 portfolio',
      completed: false,
      dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    },
  });

  await prisma.milestone.create({
    data: {
      goalId: portfolioGoal.id,
      title: 'Reach €50,000 portfolio',
      completed: false,
      dueDate: new Date(new Date().setMonth(new Date().getMonth() + 18)),
    },
  });

  console.log('✅ Milestones created.');

  // ─── 14. Create TimeEntries ───────────────────────────────────────────────

  console.log('⏰ Creating time entries...');

  const timeEntries = [
    {
      description: 'Deep work — investment research',
      startHour: 9, startMin: 0,
      durationMinutes: 90,
      category: 'Finance',
      daysBack: 1,
    },
    {
      description: 'Reading: The Psychology of Money',
      startHour: 20, startMin: 30,
      durationMinutes: 35,
      category: 'Learning',
      daysBack: 2,
    },
    {
      description: 'Tamil language practice session',
      startHour: 7, startMin: 30,
      durationMinutes: 30,
      category: 'Learning',
      daysBack: 3,
    },
    {
      description: 'Side project — LifeSync feature dev',
      startHour: 21, startMin: 0,
      durationMinutes: 120,
      category: 'Work',
      daysBack: 4,
    },
    {
      description: 'Weekly planning and goal review',
      startHour: 10, startMin: 0,
      durationMinutes: 45,
      category: 'Planning',
      daysBack: 5,
    },
  ];

  for (const te of timeEntries) {
    const startTime = new Date(daysAgo(te.daysBack));
    startTime.setHours(te.startHour, te.startMin, 0, 0);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + te.durationMinutes);

    await prisma.timeEntry.create({
      data: {
        userId: sunil.id,
        description: te.description,
        startTime,
        endTime,
        durationMinutes: te.durationMinutes,
        category: te.category,
      },
    });
  }

  console.log('✅ Time entries created.');

  // ─── 15. Create Notes ─────────────────────────────────────────────────────

  console.log('📝 Creating notes...');

  await prisma.note.create({
    data: {
      userId: sunil.id,
      title: 'Investment Strategy 2026',
      content: `# Investment Strategy 2026

## Core Allocation
- 60% India Equities (Nifty 50 stocks + ELSS)
- 20% US Tech (Apple, Nvidia via Degiro)
- 20% Mutual Funds (Flexi Cap + ELSS)

## Monthly SIP Plan
- Mirae Asset ELSS: ₹5,000/month
- Parag Parikh Flexi Cap: ₹3,000/month
- Direct stocks: ₹5,000/month when dip > 5%

## Rules
1. Never panic sell during corrections
2. Review quarterly, rebalance annually
3. Keep 6 months expenses as emergency fund`,
      tags: ['investment', 'finance', 'planning'],
      visibility: NoteVisibility.PERSONAL,
    },
  });

  await prisma.note.create({
    data: {
      userId: sunil.id,
      title: 'Marathon Training Plan',
      content: `# Amsterdam Marathon Training Plan

## Target: October 2026

### Phase 1 (Feb–Apr): Base Building
- 4 runs/week, max 40km/week
- Long run: Sunday, start at 16km
- Focus: aerobic base, no speedwork

### Phase 2 (May–Jul): Build
- 5 runs/week, peak 65km/week
- Add tempo runs on Tuesdays
- Long run peaks at 32km

### Phase 3 (Aug–Sep): Peak + Taper
- Longest run: 35km in September
- 3-week taper leading to race day

## Key Races for Practice
- Rotterdam Half Marathon — April
- Breda 10K — July`,
      tags: ['marathon', 'running', 'health', 'training'],
      visibility: NoteVisibility.PERSONAL,
    },
  });

  await prisma.note.create({
    data: {
      userId: sunil.id,
      title: 'Family Vacation Ideas 2026',
      content: `# Vacation Ideas for 2026

## Option A: South India (Tamil Nadu)
- Visit Vidhya's family in Chennai
- Mahabalipuram temples
- Kodaikanal hill station
- Best time: November–December

## Option B: Japan
- Tokyo → Kyoto → Osaka
- Cherry blossom season (late March)
- Budget: ~€4,000 for two

## Option C: Portugal Road Trip
- Lisbon → Alentejo → Algarve → Porto
- Cheaper flights from Amsterdam
- Budget: ~€2,500 for two

## Decision: Vote by April 2026`,
      tags: ['travel', 'vacation', 'family'],
      visibility: NoteVisibility.SHARED,
    },
  });

  console.log('✅ Notes created.');

  // ─── 16. Create Quotes ────────────────────────────────────────────────────

  console.log('💬 Creating quotes...');

  const quotes = [
    {
      text: 'The secret of getting ahead is getting started.',
      author: 'Mark Twain',
      category: 'Motivation',
      isFavorite: true,
    },
    {
      text: 'It does not matter how slowly you go as long as you do not stop.',
      author: 'Confucius',
      category: 'Perseverance',
      isFavorite: false,
    },
    {
      text: 'You don\'t have to be great to start, but you have to start to be great.',
      author: 'Zig Ziglar',
      category: 'Motivation',
      isFavorite: true,
    },
    {
      text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
      author: 'Winston Churchill',
      category: 'Resilience',
      isFavorite: false,
    },
    {
      text: 'The only way to do great work is to love what you do.',
      author: 'Steve Jobs',
      category: 'Work',
      isFavorite: true,
    },
    {
      text: 'In the middle of every difficulty lies opportunity.',
      author: 'Albert Einstein',
      category: 'Resilience',
      isFavorite: false,
    },
    {
      text: 'Believe you can and you\'re halfway there.',
      author: 'Theodore Roosevelt',
      category: 'Motivation',
      isFavorite: false,
    },
    {
      text: 'The best time to plant a tree was 20 years ago. The second best time is now.',
      author: 'Chinese Proverb',
      category: 'Finance',
      isFavorite: true,
    },
    {
      text: 'Take care of your body. It\'s the only place you have to live.',
      author: 'Jim Rohn',
      category: 'Health',
      isFavorite: true,
    },
    {
      text: 'Compound interest is the eighth wonder of the world.',
      author: 'Albert Einstein',
      category: 'Finance',
      isFavorite: true,
    },
    {
      text: 'Small daily improvements over time lead to stunning results.',
      author: 'Robin Sharma',
      category: 'Habits',
      isFavorite: false,
    },
    {
      text: 'The man who moves a mountain begins by carrying away small stones.',
      author: 'Confucius',
      category: 'Perseverance',
      isFavorite: false,
    },
    {
      text: 'Don\'t watch the clock; do what it does. Keep going.',
      author: 'Sam Levenson',
      category: 'Motivation',
      isFavorite: false,
    },
    {
      text: 'Energy and persistence conquer all things.',
      author: 'Benjamin Franklin',
      category: 'Perseverance',
      isFavorite: false,
    },
    {
      text: 'An investment in knowledge pays the best interest.',
      author: 'Benjamin Franklin',
      category: 'Learning',
      isFavorite: true,
    },
    {
      text: 'The groundwork of all happiness is health.',
      author: 'Leigh Hunt',
      category: 'Health',
      isFavorite: false,
    },
    {
      text: 'It always seems impossible until it\'s done.',
      author: 'Nelson Mandela',
      category: 'Motivation',
      isFavorite: false,
    },
    {
      text: 'Success usually comes to those who are too busy to be looking for it.',
      author: 'Henry David Thoreau',
      category: 'Work',
      isFavorite: false,
    },
    {
      text: 'The harder you work for something, the greater you\'ll feel when you achieve it.',
      author: 'Unknown',
      category: 'Motivation',
      isFavorite: false,
    },
    {
      text: 'Do something today that your future self will thank you for.',
      author: 'Sean Patrick Flanery',
      category: 'Habits',
      isFavorite: true,
    },
  ];

  for (const q of quotes) {
    await prisma.quote.create({
      data: {
        text: q.text,
        author: q.author,
        category: q.category,
        isFavorite: q.isFavorite,
        userId: sunil.id,
      },
    });
  }

  console.log('✅ Quotes created.');

  // ─── 17. Create XP Logs ───────────────────────────────────────────────────

  console.log('⭐ Creating XP logs...');

  const sunilXpLogs = [
    { action: 'Completed Morning Run streak — 7 days', xpEarned: 50, daysBack: 0 },
    { action: 'Completed all habits today', xpEarned: 25, daysBack: 0 },
    { action: 'Logged workout: Strength Training', xpEarned: 15, daysBack: 1 },
    { action: 'Completed habit: Meditate', xpEarned: 10, daysBack: 1 },
    { action: 'Completed habit: Read 30 min', xpEarned: 10, daysBack: 1 },
    { action: 'Completed goal milestone: First €5,000 invested', xpEarned: 100, daysBack: 2 },
    { action: 'Uploaded bank transactions', xpEarned: 20, daysBack: 2 },
    { action: 'Logged workout: Morning Run 6km', xpEarned: 15, daysBack: 3 },
    { action: 'Completed habit: Drink 2L Water', xpEarned: 10, daysBack: 3 },
    { action: 'Completed all habits today', xpEarned: 25, daysBack: 3 },
    { action: 'Added investment: Nvidia', xpEarned: 10, daysBack: 5 },
    { action: 'Completed task: Renew gym membership', xpEarned: 15, daysBack: 5 },
    { action: 'Logged workout: Weekend Ride', xpEarned: 20, daysBack: 6 },
    { action: '14-day habit streak: Meditate', xpEarned: 75, daysBack: 7 },
    { action: 'Weekly report: Grade A', xpEarned: 50, daysBack: 7 },
  ];

  for (const log of sunilXpLogs) {
    const createdAt = new Date(daysAgo(log.daysBack));
    createdAt.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60), 0, 0);
    await prisma.xpLog.create({
      data: {
        userId: sunil.id,
        action: log.action,
        xpEarned: log.xpEarned,
        createdAt,
      },
    });
  }

  const vidhyaXpLogs = [
    { action: 'Completed habit: Yoga', xpEarned: 10, daysBack: 0 },
    { action: 'Logged workout: Morning Flow', xpEarned: 15, daysBack: 1 },
    { action: 'Completed habit: Journaling', xpEarned: 10, daysBack: 1 },
    { action: '7-day Yoga streak', xpEarned: 35, daysBack: 2 },
    { action: 'Completed all habits today', xpEarned: 25, daysBack: 2 },
    { action: 'Completed task: Schedule dentist', xpEarned: 15, daysBack: 3 },
    { action: 'Logged workout: Vinyasa Flow', xpEarned: 15, daysBack: 4 },
    { action: 'Completed habit: Evening Walk', xpEarned: 10, daysBack: 5 },
    { action: 'Weekly report: Grade B+', xpEarned: 40, daysBack: 7 },
    { action: '14-day Evening Walk streak bonus', xpEarned: 50, daysBack: 10 },
  ];

  for (const log of vidhyaXpLogs) {
    const createdAt = new Date(daysAgo(log.daysBack));
    createdAt.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60), 0, 0);
    await prisma.xpLog.create({
      data: {
        userId: vidhya.id,
        action: log.action,
        xpEarned: log.xpEarned,
        createdAt,
      },
    });
  }

  console.log('✅ XP logs created.');

  console.log('\n🎉 Seed completed successfully!');
  console.log(`   Sunil: ${sunil.email} / sunil123`);
  console.log(`   Vidhya: ${vidhya.email} / vidhya123`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
