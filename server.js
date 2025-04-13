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
  // Сравнение с данными из .env
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
    // Запрос данных с Yahoo Finance
    const data = await yahooFinance.chart(ticker, {
      period1: start,
      period2: end,
      interval: '1d',
    });

    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    // Преобразуем данные для вывода: округляем до 3 знаков и заменяем точку на запятую
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

// Эндпоинт для расчётов по стратегии
app.post('/api/calculation', async (req, res) => {
  const { ticker, startDate, endDate, profitPercent, lossPercent } = req.body;
  if (!ticker || !startDate || !endDate || profitPercent === undefined || lossPercent === undefined) {
    return res.status(400).json({ 
      error: 'Не переданы все обязательные поля: ticker, startDate, endDate, profitPercent, lossPercent' 
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

    // Преобразование данных для вывода (для визуального отображения)
    const processedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'),
      high: quote.high ? quote.high.toFixed(3).replace('.', ',') : null,
      low: quote.low ? quote.low.toFixed(3).replace('.', ',') : null,
      open: quote.open ? quote.open.toFixed(3).replace('.', ',') : null,
      close: quote.close ? quote.close.toFixed(3).replace('.', ',') : null,
    }));

    console.log('Обработанные данные (для вывода):');
    console.log(JSON.stringify(processedData, null, 2));

    // Преобразуем данные обратно в числовой формат для расчётов
    const simulationData = processedData.map((entry) => ({
      date: entry.date,
      high: entry.high ? parseFloat(entry.high.replace(',', '.')) : null,
      low: entry.low ? parseFloat(entry.low.replace(',', '.')) : null,
      open: entry.open ? parseFloat(entry.open.replace(',', '.')) : null,
      close: entry.close ? parseFloat(entry.close.replace(',', '.')) : null,
    }));

    // Функция симуляции с использованием переданных параметров
    const runSimulation = (data, profitPercent, lossPercent) => {
      const profitVal = parseFloat(profitPercent);
      const lossVal = parseFloat(lossPercent);
      const PROFIT_TARGET = 1 + profitVal / 100; // Например, 4.8 -> 1.048
      const STOP_LOSS = 1 - lossVal / 100;        // Например, 12 -> 0.88

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
        console.log(`Форсированное закрытие сделки на ${lastDay.date}: результат ${forcedResult.toFixed(2)}% за ${daysInTrade} дн.`);
      }

      return {
        totalResultPercent,
        totalDays,
        avgResultPerDay: totalResultPercent / totalDays,
      };
    };

    let calcResults = [];
    for (let start = 0; start < 8; start++) {
      const slicedData = simulationData.slice(start);
      const simResult = runSimulation(slicedData, profitPercent, lossPercent);
      calcResults.push({
        startDay: start + 1,
        avgResultPerDay: simResult.avgResultPerDay.toFixed(2),
        totalResultPercent: simResult.totalResultPercent.toFixed(2),
        totalDays: simResult.totalDays,
      });
      console.log(`Средний результат % в день (начиная с ${start + 1}-го дня): ${simResult.avgResultPerDay.toFixed(2)}% (Суммарный результат: ${simResult.totalResultPercent.toFixed(2)}%, Кол-во дней: ${simResult.totalDays})`);
    }

    res.json({ results: calcResults });
  } catch (err) {
    console.error("Ошибка при расчетах:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fallback‑роут для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер расчетов запущен на http://localhost:${PORT}`);
});
