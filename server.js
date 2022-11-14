const mysql = require('mysql'); //used to interact with mysql databases
const config = require('./databaseconfig.json') //configuration file that contains sensitive database login information
const express = require('express'); //node package used to create backend server and api.

const app = express();

//database connection
const connection = mysql.createConnection({
    host: config.RDS_HOSTNAME,
    user: config.RDS_USERNAME,
    password: config.RDS_PASSWORD,
    port: config.RDS_PORT 
});

app.get("/", (req, res) => {
    res.json("hello this is the backend");
});

//returns all invoices tables
app.get("/invoices", (req, res) => {
    const q = "SELECT * FROM accounting.load_tickets_test";
    connection.query(q, (err, result, fields) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

//runs backend server on localhost:5000
app.listen(5000, () =>{
    console.log("connected to backend!");
});