import yahooFinance from 'yahoo-finance2';
import ExcelJS from 'exceljs';
import fs from 'fs';

const fetchAndCreateExcel = async () => {
  const ticker = 'GOGL'; // Тикер для тестирования
  try {
    // Запрос данных
    const data = await yahooFinance.chart(ticker, {
      period1: '2024-12-01', // Начало периода
      period2: '2024-12-10', // Конец периода
      interval: '1d',        // Интервал данных
    });

    // Проверяем структуру данных
    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    // Трансформация данных (дата + цены, округлённые до 3 знаков)
    const processedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'), // Дата в формате ДД.ММ.ГГГГ
      high: quote.high?.toFixed(3) || null,
      low: quote.low?.toFixed(3) || null,
      open: quote.open?.toFixed(3) || null,
      close: quote.close?.toFixed(3) || null,
    }));

    console.log('Обработанные данные:', JSON.stringify(processedData, null, 2));

    // Создание Excel-файла
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${ticker} Data`);

    // Добавляем заголовки
    worksheet.columns = [
      { header: ticker, key: 'ticker', width: 15 }, // Название тикера
      ...processedData.map((entry) => ({
        header: entry.date, key: `date_${entry.date}`, width: 15,
      })),
    ];

    // Формируем строки с ценами
    const rows = [
      ['Макс цена', ...processedData.map((entry) => entry.high)],
      ['Мин цена', ...processedData.map((entry) => entry.low)],
      ['Входная цена', ...processedData.map((entry) => entry.open)],
      ['Выходная цена', ...processedData.map((entry) => entry.close)],
    ];

    rows.forEach((row) => worksheet.addRow(row));

    // Настраиваем границы и выравнивание
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });

    // Сохранение файла на диск
    const filePath = `./${ticker}_Data.xlsx`;
    await workbook.xlsx.writeFile(filePath);

    console.log(`Excel файл успешно создан: ${filePath}`);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
};

fetchAndCreateExcel();
