import React, { useEffect, useState } from "react";

const History = () => {
  const [history, setHistory] = useState([]);

  // Загружаем историю из Local Storage при загрузке компонента
  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem("tableHistory")) || [];
    setHistory(storedHistory);
  }, []);

  return (
    <div className="bg-white p-4 shadow rounded mt-6">
      <h2 className="text-lg font-bold mb-4">История таблиц</h2>
      {history.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {history.map((item, index) => (
            <div
              key={index}
              className="bg-gray-200 p-4 rounded flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{item.ticker}</p>
                <p className="text-sm text-gray-600">
                  {item.startDate} - {item.endDate}
                </p>
              </div>
              <button
                onClick={() => window.location.href = item.link}
                className="bg-gray-800 text-white rounded px-2 py-1"
              >
                Скачать
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">История пуста. Создайте первую таблицу!</p>
      )}
    </div>
  );
};

export default History;
