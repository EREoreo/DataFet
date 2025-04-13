import React, { useState } from "react";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const apiUrl = import.meta.env.VITE_API_URL 
    try {
      const response = await fetch(`${apiUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLogin(); // авторизация успешна — переходим к приложению
      } else {
        setError(data.message || "Неверный логин или пароль");
      }
    } catch (err) {
      console.error(err);
      setError("Ошибка сервера");
    }
  };

  return (
    <div className="flex justify-center items-center h-screen w-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-md shadow-md">
        <h2 className="mb-4 text-xl font-bold">Авторизация</h2>
        <div className="mb-4">
          <label className="block">Логин:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block">Пароль:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        {error && <div className="mb-4 text-red-500">{error}</div>}
        <button type="submit" className="bg-green-500 text-white py-2 px-4 rounded">
          Войти
        </button>
      </form>
    </div>
  );
};

export default Login;
