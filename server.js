import express from 'express';
import cors from 'cors';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000; // Используем переменную окружения для порта

// Мидлвары
app.use(cors());
app.use(express.json()); // Для парсинга JSON-тел запросов

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
    // Успешная авторизация
    return res.json({ success: true });
  } else {
    // Неверный логин или пароль
    return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
  }
});

// Роут для получения данных по тикеру
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

    // Проверяем структуру данных
    if (!data || !data.quotes || !Array.isArray(data.quotes)) {
      throw new Error('Данные отсутствуют или имеют некорректную структуру');
    }

    // Трансформация данных
    const transformedData = data.quotes.map((quote) => ({
      date: new Date(quote.date).toLocaleDateString('ru-RU'), // Формат даты
      high: quote.high?.toFixed(3).replace('.', ',') || null,
      low: quote.low?.toFixed(3).replace('.', ',') || null,
      open: quote.open?.toFixed(3).replace('.', ',') || null,
      close: quote.close?.toFixed(3).replace('.', ',') || null,
    }));

    res.json(transformedData); // Отправляем обработанные данные клиенту
  } catch (error) {
    console.error('Ошибка при запросе данных:', error.message);
    res.status(500).json({ error: 'Ошибка при запросе данных', details: error.message });
  }
});

// Роут для всех остальных запросов (используется для SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
