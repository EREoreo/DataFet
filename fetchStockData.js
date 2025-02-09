import yahooFinance from 'yahoo-finance2';

const fetchStockData = async () => {
  const ticker = 'GOGL'; // Тикер для тестирования
  try {
    // Запрос данных
    const data = await yahooFinance.chart(ticker, {
      period1: '2024-12-01', // Начало периода
      period2: '2024-12-07', // Конец периода
      interval: '1d',        // Интервал данных (дневной)
    });

    // Проверяем структуру данных
    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    // Трансформация данных (дата + цены, округлённые до 3 знаков)
    const processedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'), // Дата в формате ДД.ММ.ГГГГ
      high: quote.high?.toFixed(3) || null, // Округляем до 3 знаков
      low: quote.low?.toFixed(3) || null,
      open: quote.open?.toFixed(3) || null,
      close: quote.close?.toFixed(3) || null,
    }));

    // Выводим только обработанные данные
    console.log( JSON.stringify(processedData, null, 2));
  } catch (error) {
    console.error('Ошибка при запросе данных:', error.message);
  }
};

fetchStockData();
