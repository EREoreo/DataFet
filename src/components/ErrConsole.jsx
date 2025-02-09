import React, { useState, useEffect } from "react";

const ErrConsole = ({ errors }) => {
  return (
    <div className="p-6 bg-gray-100 h-screen">
      <h1 className="text-2xl font-bold mb-6">Err Console</h1>
      <div className="bg-white p-4 shadow rounded overflow-y-auto h-full">
        {errors.length === 0 ? (
          <p className="text-gray-500">Нет ошибок для отображения.</p>
        ) : (
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li
                key={index}
                className="bg-red-100 text-red-600 p-3 rounded border border-red-400"
              >
                {error}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ErrConsole;
