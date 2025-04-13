import express from 'express';
import cors from 'cors';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
// Можно задать отдельный порт для расчетного сервера, например, через переменную CALC_PORT или по умолчанию 5001
const PORT = process.env.PORT 

// Мидлвары
app.use(cors());
app.use(express.json()); // Для парсинга JSON-тел запросов

// Если вам нужно отдавать также статику (например, ваш SPA), подключите следующую строчку:
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// Эндпоинт для расчетов по стратегии
app.post('/api/calculation', async (req, res) => {
  // Извлекаем параметры, переданные с фронтенда
  const { ticker, startDate, endDate, profitPercent, lossPercent } = req.body;
  if (!ticker || !startDate || !endDate || profitPercent === undefined || lossPercent === undefined) {
    return res.status(400).json({ 
      error: 'Не переданы все обязательные поля: ticker, startDate, endDate, profitPercent, lossPercent' 
    });
  }

  try {
    // Запрашиваем данные с Yahoo Finance
    const data = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    // Преобразуем данные для вывода: форматируем числа до 3 знаков после запятой и заменяем точку на запятую
    const processedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'),
      high: quote.high ? quote.high.toFixed(3).replace('.', ',') : null,
      low: quote.low ? quote.low.toFixed(3).replace('.', ',') : null,
      open: quote.open ? quote.open.toFixed(3).replace('.', ',') : null,
      close: quote.close ? quote.close.toFixed(3).replace('.', ',') : null,
    }));

    console.log('Обработанные данные (для вывода):');
    console.log(JSON.stringify(processedData, null, 2));

    // Для вычислений преобразуем данные обратно в числовой формат
    const simulationData = processedData.map((entry) => ({
      date: entry.date,
      high: entry.high ? parseFloat(entry.high.replace(',', '.')) : null,
      low: entry.low ? parseFloat(entry.low.replace(',', '.')) : null,
      open: entry.open ? parseFloat(entry.open.replace(',', '.')) : null,
      close: entry.close ? parseFloat(entry.close.replace(',', '.')) : null,
    }));

    // Функция для проведения симуляции, использующая переданные параметры стратегии
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
          // Начинаем сделку – фиксируем цену входа
          entryPrice = day.open;
          inTrade = true;
          daysInTrade = 1;

          // Если максимум дня достигает цели профита
          if (day.high >= entryPrice * PROFIT_TARGET) {
            totalResultPercent += profitVal;
            totalDays += daysInTrade;
            inTrade = false;
            continue;
          }
          // Если минимум дня ниже уровня стоп-лосса
          if (day.low <= entryPrice * STOP_LOSS) {
            totalResultPercent -= lossVal;
            totalDays += daysInTrade;
            inTrade = false;
            continue;
          }
        } else {
          // Сделка уже открыта – прибавляем день к длительности
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

      // Если сделка не закрылась до конца периода, проводим форсированное закрытие
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

    // Проведение симуляции для срезов данных с 1-го до 8-го дня
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

// Фallback‑роут для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер расчетов запущен на http://localhost:${PORT}`);
});
