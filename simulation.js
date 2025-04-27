import yahooFinance from 'yahoo-finance2';

export function runSimulation(data, profitPercent, lossPercent) {
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
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += profitVal;
        totalDays += daysInTrade;
        inTrade = false;
      } else if (day.low <= entryPrice * STOP_LOSS) {
        totalResultPercent -= lossVal;
        totalDays += daysInTrade;
        inTrade = false;
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

// Пример вызова с конкретными параметрами:
async function testBestCombo() {
  const ticker = 'GES';
  const startDate = '2025-02-28';
  const endDate = '2025-04-01';

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

  let best = { avg: -Infinity, profit: null, loss: null };
  for (let p = 0.2; p <= 20; p = +(p + 0.1).toFixed(1)) {
    for (let l = 0.2; l <= 20; l = +(l + 0.1).toFixed(1)) {
      const { avgResultPerDay } = runSimulation(data, p, l);
      if (avgResultPerDay > best.avg) {
        best = { avg: avgResultPerDay, profit: p, loss: l };
      }
    }
  }

  console.log('Лучшая комбинация:');
  console.log(`Profit: ${best.profit}%`);
  console.log(`Loss: ${best.loss}%`);
  console.log(`Средний результат в день: ${best.avg.toFixed(2)}%`);
}

testBestCombo();