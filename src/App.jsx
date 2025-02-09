import React, { useState } from "react";
import CreateTable from "./components/CreateTable";


const App = () => {
  const [tableData, setTableData] = useState([]);
  const [tickerName, setTickerName] = useState("");

  // Обновление данных таблицы из CreateTable
  const handleTableCreation = (data, ticker) => {
    setTableData(data);
    setTickerName(ticker);
  };

  return (
    <div className="flex  min-h-screen  bg-gray-100">
      <h1 className="text-2xl font-bold mb-6"></h1>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Компонент для создания таблицы */}
        <CreateTable onCreateTable={handleTableCreation} />

       
      </div>
    </div>
  );
};

export default App;
