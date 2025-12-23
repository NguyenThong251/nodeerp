// Services/MySQL/MySQLService.js
const mysql = require("mysql2/promise");

class MySQLClient {
  constructor() {
    this.connection = null;
  }

  async connect() {
    if (!this.connection || this.connection.connection._closing) {
      this.connection = await mysql.createConnection({
        host: "127.0.0.1",
        user: "thong",
        password: "thong@123",
        database: "vtigersoon",
      });
    }
    return this.connection;
  }

  async query(sql, params) {
    try {
      const connection = await this.connect();
      const [results] = await connection.query(sql, params);
      return results;
    } catch (error) {
      console.error("MySQL query error:", error);
      throw error;
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}

module.exports = new MySQLClient();
