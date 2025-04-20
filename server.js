import express from 'express';
import cors from 'cors';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
// Используем порт, заданный Render через process.env.PORT или по умолчанию 5000
const PORT = process.env.PORT || 5000;

// Мидлвары
app.use(cors());
app.use(express.json());

// Путь к статическим файлам фронтенда (после сборки)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// Эндпоинт для логина
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
  }
});

// Эндпоинт для получения данных по тикеру
app.get('/api/stock/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { start, end } = req.query;

  if (!ticker || !start || !end) {
    return res.status(400).json({ error: 'Не указаны все параметры: ticker, start, end' });
  }

  try {
    const data = await yahooFinance.chart(ticker, {
      period1: start,
      period2: end,
      interval: '1d',
    });

    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    const transformedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'),
      high: quote.high?.toFixed(3).replace('.', ',') || null,
      low: quote.low?.toFixed(3).replace('.', ',') || null,
      open: quote.open?.toFixed(3).replace('.', ',') || null,
      close: quote.close?.toFixed(3).replace('.', ',') || null,
    }));

    res.json(transformedData);
  } catch (error) {
    console.error('Ошибка при запросе данных:', error.message);
    res.status(500).json({ error: 'Ошибка при запросе данных', details: error.message });
  }
});

// Ваша функция симуляции (скопирована из /api/calculation)
function runSimulation(data, profitPercent, lossPercent) {
  const profitVal = parseFloat(profitPercent);
  const lossVal = parseFloat(lossPercent);
  const PROFIT_TARGET = 1 + profitVal / 100;
  const STOP_LOSS = 1 - lossVal / 100;

  let totalResultPercent = 0;
  let totalDays = 0;
  let inTrade = false;
  let entryPrice = 0;
  let daysInTrade = 0;

  for (let i = 0; i < data.length; i++) {
    const day = data[i];
    if (!inTrade) {
      entryPrice = day.open;
      inTrade = true;
      daysInTrade = 1;
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += profitVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
      if (day.low <= entryPrice * STOP_LOSS) {
        totalResultPercent -= lossVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
    } else {
      daysInTrade++;
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += profitVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
      if (day.low <= entryPrice * STOP_LOSS) {
        totalResultPercent -= lossVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
    }
  }

  if (inTrade) {
    const lastDay = data[data.length - 1];
    const forcedResult = ((lastDay.close / entryPrice) - 1) * 100;
    totalResultPercent += forcedResult;
    totalDays += daysInTrade;
  }

  return {
    totalResultPercent,
    totalDays,
    avgResultPerDay: totalResultPercent / totalDays,
  };
}

// Эндпоинт для расчётов по стратегии
app.post('/api/calculation', async (req, res) => {
  const { ticker, startDate, endDate, profitPercent, lossPercent } = req.body;
  if (!ticker || !startDate || !endDate || profitPercent === undefined || lossPercent === undefined) {
    return res.status(400).json({
      error: 'Не переданы все обязательные поля: ticker, startDate, endDate, profitPercent, lossPercent',
    });
  }

  try {
    const data = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });
    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    const processedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'),
      high: quote.high ? quote.high.toFixed(3).replace('.', ',') : null,
      low: quote.low ? quote.low.toFixed(3).replace('.', ',') : null,
      open: quote.open ? quote.open.toFixed(3).replace('.', ',') : null,
      close: quote.close ? quote.close.toFixed(3).replace('.', ',') : null,
    }));

    const simulationData = processedData.map((entry) => ({
      date: entry.date,
      high: entry.high ? parseFloat(entry.high.replace(',', '.')) : null,
      low: entry.low ? parseFloat(entry.low.replace(',', '.')) : null,
      open: entry.open ? parseFloat(entry.open.replace(',', '.')) : null,
      close: entry.close ? parseFloat(entry.close.replace(',', '.')) : null,
    }));

    let calcResults = [];
    for (let start = 0; start < 8; start++) {
      const slice = simulationData.slice(start);
      const sim = runSimulation(slice, profitPercent, lossPercent);
      calcResults.push({
        startDay: start + 1,
        avgResultPerDay: sim.avgResultPerDay.toFixed(2),
        totalResultPercent: sim.totalResultPercent.toFixed(2),
        totalDays: sim.totalDays,
      });
    }

    res.json({ results: calcResults });
  } catch (err) {
    console.error('Ошибка при расчетах:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// *** НОВЫЙ РОУТ: поиск лучшей комбинации ***
app.post('/api/best-combo', async (req, res) => {
  const { ticker, startDate, endDate } = req.body;
  if (!ticker || !startDate || !endDate) {
    return res.status(400).json({ error: 'Не переданы все обязательные поля' });
  }

  try {
    // Получаем сырые котировки
    const data = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });
    const quotes = data.quotes;
    if (!quotes || !Array.isArray(quotes)) {
      throw new Error('Неправильная структура данных для best-combo');
    }

    // Приводим к числовому массиву
    const prices = quotes.map(q => ({
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
    }));

    // Перебираем все пары (0.2; 0.3; ...; 20) на шаге 0.1
    let best = { avg: -Infinity, profit: null, loss: null };
    for (let p = 0.2; p <= 20; p = +(p + 0.1).toFixed(1)) {
      for (let l = 0.2; l <= 20; l = +(l + 0.1).toFixed(1)) {
        const { avgResultPerDay } = runSimulation(prices, p, l);
        if (avgResultPerDay > best.avg) {
          best = { avg: avgResultPerDay, profit: p, loss: l };
        }
      }
    }

    return res.json({
      profit: best.profit,
      loss: best.loss,
      avgResultPerDay: best.avg,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Fallback‑роут для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

