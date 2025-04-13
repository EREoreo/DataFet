import yahooFinance from 'yahoo-finance2';

// Функция для преобразования строки цены с запятой в число с плавающей запятой
const parsePrice = (priceStr) => {
  if (!priceStr) return null;
  return parseFloat(priceStr.replace(',', '.'));
};

// Функция, реализующая симуляцию по стратегии
const runSimulation = (data) => {
  // Стратегия
  const PROFIT_TARGET = 1.048; // Порог для профита: entry * 1.048 = +4,8%
  const STOP_LOSS = 0.88;      // Порог для стопа: entry * 0.88 = -12%
  const PROFIT_RESULT = 4.8;
  const LOSS_RESULT = -12;

  let totalResultPercent = 0; // суммарный процент по сделкам
  let totalDays = 0;          // общее количество дней, когда сделки были активны
  let inTrade = false;
  let entryPrice = 0;
  let daysInTrade = 0;

  for (let i = 0; i < data.length; i++) {
    const day = data[i];

    if (!inTrade) {
      // Начинаем новую сделку по цене открытия текущего дня
      entryPrice = day.open;
      inTrade = true;
      daysInTrade = 1;

      // Проверяем условия сразу же для дня открытия
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += PROFIT_RESULT;
        totalDays += daysInTrade;
        inTrade = false;
        continue; // сделка закрыта, переходим к следующему дню
      }
      if (day.low <= entryPrice * STOP_LOSS) {
        totalResultPercent += LOSS_RESULT;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
    } else {
      // Сделка уже открыта, прибавляем один день к её длительности
      daysInTrade++;
      if (day.high >= entryPrice * PROFIT_TARGET) {
        totalResultPercent += PROFIT_RESULT;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
      if (day.low <= entryPrice * STOP_LOSS) {
        totalResultPercent += LOSS_RESULT;
        totalDays += daysInTrade;
        inTrade = false;
        continue;
      }
    }
  }

  // Если в конце периода сделка не закрылась, форсированное закрытие по последней цене close
  if (inTrade) {
    const lastDay = data[data.length - 1];
    const forcedResult = ((lastDay.close / entryPrice) - 1) * 100;
    totalResultPercent += forcedResult;
    totalDays += daysInTrade;
    // Выводим сообщение о форсированном закрытии (опционально)
    console.log(`Форсированное закрытие сделки на ${lastDay.date}: результат ${forcedResult.toFixed(2)}% за ${daysInTrade} дн.`);
  }
  return {
    totalResultPercent,
    totalDays,
    avgResultPerDay: totalResultPercent / totalDays
  };
};

const fetchStockData = async () => {
  const ticker = 'GES'; // Тикер для тестирования
  try {
    // Запрос данных
    const data = await yahooFinance.chart(ticker, {
      period1: '2025-02-28', // Начало периода
      period2: '2025-04-01', // Конец периода
      interval: '1d',        // Дневной интервал
    });

    // Проверяем структуру данных
    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    // Преобразование данных для вывода: форматируем до 3 знаков, заменяем точку на запятую
    const processedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'),
      high: quote.high?.toFixed(3).replace('.', ',') || null,
      low: quote.low?.toFixed(3).replace('.', ',') || null,
      open: quote.open?.toFixed(3).replace('.', ',') || null,
      close: quote.close?.toFixed(3).replace('.', ',') || null,
    }));

    console.log('Обработанные данные (для вывода):');
    console.log(JSON.stringify(processedData, null, 2));

    // Для вычислений преобразуем цены обратно в числа
    const simulationData = processedData.map((entry) => ({
      date: entry.date,
      high: parsePrice(entry.high),
      low: parsePrice(entry.low),
      open: parsePrice(entry.open),
      close: parsePrice(entry.close),
    }));

    // Выполняем симуляцию для срезов данных, начиная с 1-го, 2-го, …, 8-го дня
    for (let start = 0; start < 8; start++) {
      // Создаем новый массив, начиная с указанного дня
      const slicedData = simulationData.slice(start);
      const result = runSimulation(slicedData);
      console.log(`Средний результат % в день (начиная с ${start + 1}-го дня): ${result.avgResultPerDay.toFixed(2)}% (Суммарный результат: ${result.totalResultPercent.toFixed(2)}%, Кол-во дней: ${result.totalDays})`);
    }

  } catch (error) {
    console.error('Ошибка при запросе данных:', error.message);
  }
};

fetchStockData();
