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
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function runLongSimulationAdvanced(data, profitPercent, lossPercent) {
  const profitVal = parseFloat(profitPercent);
  const lossVal = parseFloat(lossPercent);
  const PROFIT_TARGET = 1 + profitVal / 100;
  const STOP_LOSS = 1 - lossVal / 100;

  let totalResultPercent = 0;
  let totalDays = 0;
  let inTrade = false;
  let entryPrice = 0;
  let daysInTrade = 0;
  let positiveTrades = 0;
  let negativeTrades = 0;
  let totalTrades = 0;

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
        negativeTrades++;
        totalTrades++;
        inTrade = false;
        continue;
      }
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += profitVal;
        totalDays += daysInTrade;
        positiveTrades++;
        totalTrades++;
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
    totalTrades++;
    if (forcedResult >= 0) {
      positiveTrades++;
    } else {
      negativeTrades++;
    }
  }

  const successRate = (positiveTrades / totalTrades) * 100;
  const failureRate = (negativeTrades / totalTrades) * 100;

  return {
    totalResultPercent,
    totalDays,
    avgResultPerDay: totalResultPercent / totalDays,
    successRate,
    failureRate,
  };
}

function runShortSimulationAdvanced(data, profitPercent, lossPercent) {
  const profitVal = parseFloat(profitPercent);
  const lossVal = parseFloat(lossPercent);
  const PROFIT_TARGET = 1 + lossVal / 100;
  const STOP_PROFIT = 1 - profitVal / 100;

  let totalResultPercent = 0;
  let totalDays = 0;
  let inTrade = false;
  let entryPrice = 0;
  let daysInTrade = 0;
  let positiveTrades = 0;
  let negativeTrades = 0;
  let totalTrades = 0;

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
        negativeTrades++;
        totalTrades++;
        inTrade = false;
        continue;
      }
      if (day.low <= entryPrice * STOP_PROFIT) {
        totalResultPercent += profitVal;
        totalDays += daysInTrade;
        positiveTrades++;
        totalTrades++;
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
    totalTrades++;
    if (forcedResult >= 0) {
      positiveTrades++;
    } else {
      negativeTrades++;
    }
  }

  const successRate = (positiveTrades / totalTrades) * 100;
  const failureRate = (negativeTrades / totalTrades) * 100;

  return {
    totalResultPercent,
    totalDays,
    avgResultPerDay: totalResultPercent / totalDays,
    successRate,
    failureRate,
  };
}


app.post(
  '/api/batch-best-advanced',
  multer({ storage: multer.memoryStorage() }).single('file'),
  async (req, res) => {
    const { startDate, endDate, minSuccessLong, maxFailLong, minSuccessShort, maxFailShort } = req.body;

    if (!req.file || !startDate || !endDate) {
      return res.status(400).json({ error: 'Файл и даты обязательны' });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Результаты');

      // Заголовки
      worksheet.addRow([
        'Тикер',
        'Лонг профит', 'Лонг лосс', 'Лонг % в день', 'Лонг % успеха', 'Лонг % неуспеха',
        'Шорт профит', 'Шорт лосс', 'Шорт % в день', 'Шорт % успеха', 'Шорт % неуспеха'
      ]);

      const originalWorkbook = XLSX.read(req.file.buffer);
      const sheet = originalWorkbook.Sheets[originalWorkbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      let startRow = rows.findIndex(
        (row) =>
          row[0] &&
          typeof row[0] === 'string' &&
          !row[0].toLowerCase().includes('тикер')
      );
      if (startRow === -1) startRow = 0;

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

          const originalData = raw.quotes.map((q) => ({
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
          }));

          let bestLong = null;
          let bestShort = null;

          for (let start = 0; start < 8; start++) {
            const sliceData = originalData.slice(start);

            // ЛОНГ
            for (let profit = 0.5; profit <= 20; profit += 0.1) {
              for (let loss = 0.5; loss <= 20; loss += 0.1) {
                const sim = runLongSimulationAdvanced(sliceData, profit, loss);
                if (
                  sim.successRate >= minSuccessLong &&
                  sim.failureRate <= maxFailLong
                ) {
                  if (!bestLong || sim.avgResultPerDay > bestLong.avgResultPerDay) {
                    bestLong = { profit, loss, ...sim };
                  }
                }
              }
            }

            // ШОРТ
            for (let profit = 0.5; profit <= 20; profit += 0.1) {
              for (let loss = 0.5; loss <= 20; loss += 0.1) {
                const sim = runShortSimulationAdvanced(sliceData, profit, loss);
                if (
                  sim.successRate >= minSuccessShort &&
                  sim.failureRate <= maxFailShort
                ) {
                  if (!bestShort || sim.avgResultPerDay > bestShort.avgResultPerDay) {
                    bestShort = { profit, loss, ...sim };
                  }
                }
              }
            }
          }

          let row;
          if (bestLong && bestShort) {
            row = worksheet.addRow([
              ticker,
              bestLong.profit.toFixed(1).replace('.', ','), bestLong.loss.toFixed(1).replace('.', ','),
              bestLong.avgResultPerDay.toFixed(2).replace('.', ','),
              bestLong.successRate.toFixed(2).replace('.', ','), bestLong.failureRate.toFixed(2).replace('.', ','),
              bestShort.profit.toFixed(1).replace('.', ','), bestShort.loss.toFixed(1).replace('.', ','),
              bestShort.avgResultPerDay.toFixed(2).replace('.', ','),
              bestShort.successRate.toFixed(2).replace('.', ','), bestShort.failureRate.toFixed(2).replace('.', ',')
            ]);

            // Зелёная заливка
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCCFFCC' } // светло-зелёный
              };
            });
          } else {
            row = worksheet.addRow([
              ticker, 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR'
            ]);

            // Красная заливка
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCCCC' } // светло-красный
              };
            });
          }
        } catch (err) {
          console.error(`Ошибка по тикеру ${ticker}: ${err.message}`);
          const row = worksheet.addRow([
            ticker, 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR', 'ERR'
          ]);

          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFCCCC' }
            };
          });
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
  }
);



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
