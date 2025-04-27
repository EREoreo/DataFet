// simulateBestCombo.js
import yahooFinance from 'yahoo-finance2';

const ticker = 'FN';
const startDate = '2025-02-28';
const endDate = '2025-04-01';

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
    avgResultPerDay: totalResultPercent / totalDays
  };
}

async function main() {
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

    for (let profit = 0.2; profit <= 20; profit = +(profit + 0.1).toFixed(1)) {
      for (let loss = 0.2; loss <= 20; loss = +(loss + 0.1).toFixed(1)) {
        const slicedData = data.slice(0); // Полные данные без среза
        const sim = runSimulation(slicedData, profit, loss);

        if (sim.avgResultPerDay > bestResult.avgResultPerDay) {
          bestResult = {
            profit,
            loss,
            avgResultPerDay: sim.avgResultPerDay,
          };
        }
      }
    }

    console.log('Лучшая комбинация:');
    console.log(`Профит: ${bestResult.profit.toFixed(1)}%`);
    console.log(`Лосс: ${bestResult.loss.toFixed(1)}%`);
    console.log(`Средний результат в день: ${bestResult.avgResultPerDay.toFixed(4)}%`);
  } catch (e) {
    console.error('Ошибка при получении или обработке данных:', e.message);
  }
}

main();
