import express from 'express';
import cors from 'cors';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import multer from 'multer';
import XLSX from 'xlsx';
import { tmpdir } from 'os';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
  }
});

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
//---------------------------------------------------------

//---------------------------------------------------------

// ====== ЛОНГ симуляция ======
function runLongSimulation(data, profitPercent, lossPercent) {
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
    } else {
      daysInTrade++;
    }

    if (inTrade) {
      if (day.low <= entryPrice * STOP_LOSS) {
        totalResultPercent -= lossVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += profitVal;
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

// ====== ШОРТ симуляция ======
function runShortSimulation(data, profitPercent, lossPercent) {
  const profitVal = parseFloat(profitPercent);
  const lossVal = parseFloat(lossPercent);
  const PROFIT_TARGET = 1 + lossVal / 100;
  const STOP_PROFIT = 1 - profitVal / 100;

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
    } else {
      daysInTrade++;
    }

    if (inTrade) {
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent -= lossVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
      if (day.low <= entryPrice * STOP_PROFIT) {
        totalResultPercent += profitVal;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
    }
  }

  if (inTrade) {
    const lastDay = data[data.length - 1];
    const forcedResult = ((entryPrice / lastDay.close) - 1) * 100;
    totalResultPercent += forcedResult;
    totalDays += daysInTrade;
  }

  return {
    totalResultPercent,
    totalDays,
    avgResultPerDay: totalResultPercent / totalDays,
  };
}

// ====== ЛОНГ расчет ======
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
      const sim = runLongSimulation(slice, profitPercent, lossPercent);
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

// ====== ШОРТ расчет ======
app.post('/api/calculation-short', async (req, res) => {
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
      const sim = runShortSimulation(slice, profitPercent, lossPercent);
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

app.post('/api/best-long', async (req, res) => {
  const { ticker, startDate, endDate } = req.body;
  if (!ticker || !startDate || !endDate) {
    return res.status(400).json({
      error: 'Не переданы все обязательные поля: ticker, startDate, endDate',
    });
  }

  function runSimulation(data, profit, loss) {
    const PROFIT_TARGET = 1 + profit / 100;
    const STOP_LOSS = 1 - loss / 100;

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
      } else {
        daysInTrade++;
      }

      if (inTrade) {
        if (day.low <= entryPrice * STOP_LOSS) {
          totalResultPercent -= loss;
          totalDays += daysInTrade;
          inTrade = false;
          continue;
        } else if (day.high >= entryPrice * PROFIT_TARGET) {
          totalResultPercent += profit;
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

  try {
    const rawData = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    const data = rawData.quotes.map((q) => ({
      date: q.date,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
    }));

    let bestResult = {
      profit: 0,
      loss: 0,
      avgResultPerDay: -Infinity,
    };

    for (let profit = 0.7; profit <= 10; profit = +(profit + 0.1).toFixed(1)) {
      for (let loss = 5; loss <= 30; loss = +(loss + 0.1).toFixed(1)) {
        const sim = runSimulation(data, profit, loss);
        if (sim.avgResultPerDay > bestResult.avgResultPerDay) {
          bestResult = {
            profit,
            loss,
            avgResultPerDay: sim.avgResultPerDay,
          };
        }
      }
    }

    res.json({
      profitPercent: bestResult.profit,
      lossPercent: bestResult.loss,
      avgResultPerDay: bestResult.avgResultPerDay,
    });
  } catch (error) {
    console.error('Ошибка при расчете лучшей комбинации:', error.message);
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/best-short', async (req, res) => {
  const { ticker, startDate, endDate } = req.body;
  if (!ticker || !startDate || !endDate) {
    return res.status(400).json({
      error: 'Не переданы все обязательные поля: ticker, startDate, endDate',
    });
  }

  function runShortSimulation(data, profit, loss) {
    const PROFIT_TARGET = 1 + loss / 100;
    const STOP_PROFIT = 1 - profit / 100;

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
      } else {
        daysInTrade++;
      }

      if (inTrade) {
        if (day.high >= entryPrice * PROFIT_TARGET) {
          totalResultPercent -= loss;
          totalDays += daysInTrade;
          inTrade = false;
          continue;
        } else if (day.low <= entryPrice * STOP_PROFIT) {
          totalResultPercent += profit;
          totalDays += daysInTrade;
          inTrade = false;
          continue;
        }
      }
    }

    if (inTrade) {
      const lastDay = data[data.length - 1];
      const forcedResult = ((entryPrice / lastDay.close) - 1) * 100;
      totalResultPercent += forcedResult;
      totalDays += daysInTrade;
    }

    return {
      totalResultPercent,
      totalDays,
      avgResultPerDay: totalResultPercent / totalDays,
    };
  }

  try {
    const rawData = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    const data = rawData.quotes.map((q) => ({
      date: q.date,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
    }));

    let bestResult = {
      profit: 0,
      loss: 0,
      avgResultPerDay: -Infinity,
    };

    for (let profit = 5; profit <= 30; profit = +(profit + 0.1).toFixed(1)) {
      for (let loss = 0.7; loss <= 10; loss = +(loss + 0.1).toFixed(1)) {
        const sim = runShortSimulation(data, profit, loss);
        if (sim.avgResultPerDay > bestResult.avgResultPerDay) {
          bestResult = {
            profit,
            loss,
            avgResultPerDay: sim.avgResultPerDay,
          };
        }
      }
    }

    res.json({
      profitPercent: bestResult.profit,
      lossPercent: bestResult.loss,
      avgResultPerDay: bestResult.avgResultPerDay,
    });
  } catch (error) {
    console.error('Ошибка при расчете лучшей комбинации для шорт:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОДБОРА ЛУЧШЕЙ КОМБИНАЦИИ =====
function findBestCombo(data, type = 'long') {
  let best = { profit: 0, loss: 0, avgResultPerDay: -Infinity };

  for (let profit = 0.2; profit <= 20; profit = +(profit + 0.1).toFixed(1)) {
    for (let loss = 0.2; loss <= 20; loss = +(loss + 0.1).toFixed(1)) {
      const sim = type === 'long'
        ? runLongSimulation(data, profit, loss)
        : runShortSimulation(data, profit, loss);

      if (sim.avgResultPerDay > best.avgResultPerDay) {
        best = { profit, loss, avgResultPerDay: sim.avgResultPerDay };
      }
    }
  }

  return best;
}

// ===== ЭНДПОИНТ /api/batch-best-combo =====
app.post(
'/api/batch-best-combo',
  multer({ storage: multer.memoryStorage() }).single('file'),
  async (req, res) => {
    const { startDate, endDate } = req.body;

    if (!req.file || !startDate || !endDate) {
      return res.status(400).json({ error: 'Файл, startDate и endDate обязательны' });
    }

    try {
      const workbook = XLSX.read(req.file.buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Автоопределение первой строки с тикерами
      let startRow = rows.findIndex(
        (row) =>
          row[0] &&
          typeof row[0] === 'string' &&
          !row[0].toLowerCase().includes('тикер') &&
          !row[0].toLowerCase().includes('лонг') &&
          !row[0].toLowerCase().includes('шорт')
      );
      if (startRow === -1) startRow = 0;

      const output = [[
        'Тикер',
        'Лонг профит', 'Лонг лосс', 'Лонг % в день',
        'Шорт профит', 'Шорт лосс', 'Шорт % в день'
      ]];

      for (let i = startRow; i < rows.length; i++) {
        const ticker = rows[i][0];
        if (!ticker || typeof ticker !== 'string') continue;

        console.log(`Обработка ${ticker}...`);

        try {
          const raw = await yahooFinance.chart(ticker, {
            period1: startDate,
            period2: endDate,
            interval: '1d',
          });

          const data = raw.quotes.map((q) => ({
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
          }));

          const bestLong = findBestCombo(data, 'long');
          const bestShort = findBestCombo(data, 'short');

          output.push([
            ticker,
            bestLong.profit.toString().replace('.', ','),
            bestLong.loss.toString().replace('.', ','),
            bestLong.avgResultPerDay.toFixed(2).replace('.', ','),
            bestShort.profit.toString().replace('.', ','),
            bestShort.loss.toString().replace('.', ','),
            bestShort.avgResultPerDay.toFixed(2).replace('.', ','),
          ]);
        } catch (err) {
          console.error(`Ошибка по тикеру ${ticker}: ${err.message}`);
          output.push([ticker, 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR']);
        }
      }

      const resultSheet = XLSX.utils.aoa_to_sheet(output);
      const resultBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(resultBook, resultSheet, 'Результаты');

      const buffer = XLSX.write(resultBook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="result.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (err) {
      console.error('Ошибка при обработке файла:', err.message);
      res.status(500).json({ error: 'Ошибка при обработке файла' });
    }
  }
);
  //-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/// ===== ЛОНГ Advanced симуляция =====
function runLongAdvancedSimulation(data, profitPercent, lossPercent) {
  const PROFIT_TARGET = 1 + profitPercent / 100;
  const STOP_LOSS = 1 - lossPercent / 100;

  let inTrade = false;
  let entryPrice = 0;
  let daysInTrade = 0;

  let totalResultPercent = 0;
  let totalDays = 0;
  let positiveTrades = 0;
  let negativeTrades = 0;
  let totalTrades = 0;

  for (const day of data) {
    if (!inTrade) {
      entryPrice = day.open;
      inTrade = true;
      daysInTrade = 1;
    } else {
      daysInTrade++;
    }

    if (day.low <= entryPrice * STOP_LOSS) {
      totalResultPercent -= lossPercent;
      totalDays += daysInTrade;
      negativeTrades++;
      totalTrades++;
      inTrade = false;
      continue;
    }
    if (day.high >= entryPrice * PROFIT_TARGET) {
      totalResultPercent += profitPercent;
      totalDays += daysInTrade;
      positiveTrades++;
      totalTrades++;
      inTrade = false;
      continue;
    }
  }

  if (inTrade && data.length > 0) {
    const lastDay = data[data.length - 1];
    const forcedResult = ((lastDay.close / entryPrice) - 1) * 100;
    totalResultPercent += forcedResult;
    totalDays += daysInTrade;
    totalTrades++;
    if (forcedResult >= 0) positiveTrades++;
    else negativeTrades++;
  }

  let avgResultPerDaySum = 0;
  for (let start = 0; start < 8; start++) {
    const slicedData = data.slice(start);
    if (slicedData.length === 0) continue;

    let sliceResultPercent = 0;
    let sliceDays = 0;
    let sliceInTrade = false;
    let sliceEntryPrice = 0;
    let sliceDaysInTrade = 0;

    for (const day of slicedData) {
      if (!sliceInTrade) {
        sliceEntryPrice = day.open;
        sliceInTrade = true;
        sliceDaysInTrade = 1;
      } else {
        sliceDaysInTrade++;
      }

      if (day.low <= sliceEntryPrice * STOP_LOSS) {
        sliceResultPercent -= lossPercent;
        sliceDays += sliceDaysInTrade;
        sliceInTrade = false;
        continue;
      }
      if (day.high >= sliceEntryPrice * PROFIT_TARGET) {
        sliceResultPercent += profitPercent;
        sliceDays += sliceDaysInTrade;
        sliceInTrade = false;
        continue;
      }
    }

    if (sliceInTrade && slicedData.length > 0) {
      const lastDay = slicedData[slicedData.length - 1];
      const forcedResult = ((lastDay.close / sliceEntryPrice) - 1) * 100;
      sliceResultPercent += forcedResult;
      sliceDays += sliceDaysInTrade;
    }

    if (sliceDays > 0) {
      avgResultPerDaySum += sliceResultPercent / sliceDays;
    }
  }

  const avgResultPerDay = avgResultPerDaySum / 8;
  const successRate = (positiveTrades / totalTrades) * 100;
  const failureRate = (negativeTrades / totalTrades) * 100;

  return {
    totalDays,
    positiveTrades,
    negativeTrades,
    avgResultPerDay,
    successRate,
    failureRate,
  };
}

function runShortAdvancedSimulation(data, profitPercent, lossPercent) {
  const PROFIT_TARGET = 1 + lossPercent / 100;
  const STOP_PROFIT = 1 - profitPercent / 100;

  let inTrade = false;
  let entryPrice = 0;
  let daysInTrade = 0;

  let totalResultPercent = 0;
  let totalDays = 0;
  let positiveTrades = 0;
  let negativeTrades = 0;
  let totalTrades = 0;

  for (const day of data) {
    if (!inTrade) {
      entryPrice = day.open;
      inTrade = true;
      daysInTrade = 1;
    } else {
      daysInTrade++;
    }

    if (day.high >= entryPrice * PROFIT_TARGET) {
      totalResultPercent -= lossPercent;
      totalDays += daysInTrade;
      negativeTrades++;
      totalTrades++;
      inTrade = false;
      continue;
    }
    if (day.low <= entryPrice * STOP_PROFIT) {
      totalResultPercent += profitPercent;
      totalDays += daysInTrade;
      positiveTrades++;
      totalTrades++;
      inTrade = false;
      continue;
    }
  }

  if (inTrade && data.length > 0) {
    const lastDay = data[data.length - 1];
    const forcedResult = ((entryPrice / lastDay.close) - 1) * 100;
    totalResultPercent += forcedResult;
    totalDays += daysInTrade;
    totalTrades++;
    if (forcedResult >= 0) positiveTrades++;
    else negativeTrades++;
  }

  let avgResultPerDaySum = 0;
  for (let start = 0; start < 8; start++) {
    const slicedData = data.slice(start);
    if (slicedData.length === 0) continue;

    let sliceResultPercent = 0;
    let sliceDays = 0;
    let sliceInTrade = false;
    let sliceEntryPrice = 0;
    let sliceDaysInTrade = 0;

    for (const day of slicedData) {
      if (!sliceInTrade) {
        sliceEntryPrice = day.open;
        sliceInTrade = true;
        sliceDaysInTrade = 1;
      } else {
        sliceDaysInTrade++;
      }

      if (day.high >= sliceEntryPrice * PROFIT_TARGET) {
        sliceResultPercent -= lossPercent;
        sliceDays += sliceDaysInTrade;
        sliceInTrade = false;
        continue;
      }
      if (day.low <= sliceEntryPrice * STOP_PROFIT) {
        sliceResultPercent += profitPercent;
        sliceDays += sliceDaysInTrade;
        sliceInTrade = false;
        continue;
      }
    }

    if (sliceInTrade && slicedData.length > 0) {
      const lastDay = slicedData[slicedData.length - 1];
      const forcedResult = ((sliceEntryPrice / lastDay.close) - 1) * 100;
      sliceResultPercent += forcedResult;
      sliceDays += sliceDaysInTrade;
    }

    if (sliceDays > 0) {
      avgResultPerDaySum += sliceResultPercent / sliceDays;
    }
  }

  const avgResultPerDay = avgResultPerDaySum / 8;
  const successRate = (positiveTrades / totalTrades) * 100;
  const failureRate = (negativeTrades / totalTrades) * 100;

  return {
    totalDays,
    positiveTrades,
    negativeTrades,
    avgResultPerDay,
    successRate,
    failureRate,
  };
}

app.post('/api/batch-best-advanced', multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  const { startDate, endDate, minSuccessLong, maxFailLong, minSuccessShort, maxFailShort } = req.body;

  if (!req.file || !startDate || !endDate) {
    return res.status(400).json({ error: 'Файл и даты обязательны' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Результаты');

    worksheet.addRow([
      'Тикер',
      'Лонг Дни', 'Лонг Плюс', 'Лонг Минус', 'Лонг % в день', 'Лонг Профит', 'Лонг Лосс',
      'Шорт Дни', 'Шорт Плюс', 'Шорт Минус', 'Шорт % в день', 'Шорт Профит', 'Шорт Лосс'
    ]);

    const originalWorkbook = XLSX.read(req.file.buffer);
    const sheet = originalWorkbook.Sheets[originalWorkbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const startRow = rows.findIndex((row) => row[0] && typeof row[0] === 'string' && !row[0].toLowerCase().includes('тикер'));

    for (let i = startRow; i < rows.length; i++) {
      const ticker = rows[i][0];
      if (!ticker) continue;

      try {
        const rawData = await yahooFinance.chart(ticker, {
          period1: startDate,
          period2: endDate,
          interval: '1d',
        });

        const data = rawData.quotes.map(q => ({
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
        }));

        let bestLong = null;
        let bestShort = null;

        // Long поиск
        for (let profit = 0.7; profit <= 10; profit += 0.1) {
          for (let loss = 5; loss <= 30; loss += 0.1) {
            const sim = runLongAdvancedSimulation(data, profit, loss);

            const minPositiveDays = sim.totalDays * minSuccessLong / 100;
            const maxNegativeDays = sim.totalDays * maxFailLong / 100;

            if (
              sim.positiveTrades >= minPositiveDays &&
              sim.negativeTrades <= maxNegativeDays
            ) {
              if (!bestLong || sim.avgResultPerDay > bestLong.avgResultPerDay) {
                bestLong = { profit, loss, ...sim };
              }
            }
          }
        }

        // Short поиск
        for (let profit = 5; profit <= 30; profit += 0.1) {
          for (let loss = 0.7; loss <= 10; loss += 0.1) {
            const sim = runShortAdvancedSimulation(data, profit, loss);

            const minPositiveDays = sim.totalDays * minSuccessShort / 100;
            const maxNegativeDays = sim.totalDays * maxFailShort / 100;

            if (
              sim.positiveTrades >= minPositiveDays &&
              sim.negativeTrades <= maxNegativeDays
            ) {
              if (!bestShort || sim.avgResultPerDay > bestShort.avgResultPerDay) {
                bestShort = { profit, loss, ...sim };
              }
            }
          }
        }

        const row = worksheet.addRow([
          ticker,
          bestLong ? bestLong.totalDays : '—',
          bestLong ? bestLong.positiveTrades : '—',
          bestLong ? bestLong.negativeTrades : '—',
          bestLong ? bestLong.avgResultPerDay.toFixed(2) : '—',
          bestLong ? bestLong.profit.toFixed(1) : '—',
          bestLong ? bestLong.loss.toFixed(1) : '—',
          bestShort ? bestShort.totalDays : '—',
          bestShort ? bestShort.positiveTrades : '—',
          bestShort ? bestShort.negativeTrades : '—',
          bestShort ? bestShort.avgResultPerDay.toFixed(2) : '—',
          bestShort ? bestShort.profit.toFixed(1) : '—',
          bestShort ? bestShort.loss.toFixed(1) : '—'
        ]);

        const longColor = bestLong ? 'FFCCFFCC' : 'FFFFCCCC';
        const shortColor = bestShort ? 'FFCCFFCC' : 'FFFFCCCC';

        row.eachCell((cell, colNumber) => {
          if (colNumber >= 2 && colNumber <= 7) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: longColor }
            };
          }
          if (colNumber >= 8 && colNumber <= 13) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: shortColor }
            };
          }
        });

      } catch (err) {
        console.error(`Ошибка по тикеру ${ticker}:`, err.message);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', 'attachment; filename="result.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error('Ошибка при обработке файла:', err.message);
    res.status(500).json({ error: 'Ошибка при обработке файла' });
  }
});
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
router.post('/api/finviz', async (req, res) => {
  const exchange = req.query.exchange;

  if (!['nyse', 'nasdaq'].includes(exchange)) {
    return res.status(400).json({ error: 'Укажите правильную биржу: nyse или nasdaq' });
  }

  const BASE_URL = {
    nyse: 'https://finviz.com/screener.ashx?v=111&f=exch_nyse,ind_stocksonly,sh_avgvol_o300,sh_price_o5',
    nasdaq: 'https://finviz.com/screener.ashx?v=111&f=exch_nasd,ind_stocksonly,sh_avgvol_o300,sh_price_o5',
  }[exchange];

  const OFFSETS = Array.from({ length: Math.ceil(1355 / 20) }, (_, i) => (i === 0 ? 1 : i * 20 + 1));
  const CONCURRENCY = 5;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function scrapeOffset(page, offset) {
    const url = offset === 1 ? BASE_URL : `${BASE_URL}&r=${offset}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
    await sleep(3000);

    const tickers = await page.$$eval(
      'a[href*="quote.ashx?t="]',
      links => Array.from(new Set(
        links.map(a => a.textContent.trim()).filter(t => /^[A-Z]+$/.test(t) && t !== 'USA')
      ))
    );
    return tickers;
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const pages = await Promise.all(Array.from({ length: CONCURRENCY }, () => browser.newPage()));

    for (const page of pages) {
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType()))
          req.abort();
        else
          req.continue();
      });

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36');
    }

    const all = new Set();

    for (let i = 0; i < OFFSETS.length; i += CONCURRENCY) {
      const batch = OFFSETS.slice(i, i + CONCURRENCY);
      console.log(`>>> [${exchange}] Scraping offsets: ${batch.join(', ')}`);
      const results = await Promise.all(
        batch.map((offset, idx) => scrapeOffset(pages[idx], offset))
      );
      results.forEach(arr => arr.forEach(t => all.add(t)));
      console.log(`    → Accumulated [${exchange}]: ${all.size}`);
    }

    await browser.close();

    const tickers = Array.from(all).filter(t => t !== 'USA');
    const csv = tickers.join('\n');

    res.setHeader('Content-Disposition', `attachment; filename=${exchange}_tickers.csv`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('Ошибка в эндпоинте /api/finviz:', err);
    res.status(500).json({ error: 'Ошибка при сборе тикеров' });
  }
});

export default router;




app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
