const mysql = require('mysql');
require('dotenv').config();
const bcrypt = require('bcryptjs');

//Database connection
const connection = mysql.createConnection({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  port: process.env.RDS_PORT 
});

//Function to find a user in database
async function findUser(username) {
  return new Promise((resolve, reject) => {
    const q = `SELECT Username, Passcode, id FROM Login.Login WHERE Username = "${username}" `;
    connection.query(q, (err, result) => {
        if (err) reject(new Error('fail'));
        if(result[0]) resolve({username: result[0].Username, password: result[0].Passcode, id: result[0].id});
        reject(new Error('invalid'));
    });
  });
}

