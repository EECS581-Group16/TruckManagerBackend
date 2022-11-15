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
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

//posts new data into database -- currently harcoded for testing, will eventually take user input from front end
app.post("/invoices", (req, res) => {
    const q = "INSERT INTO accounting.load_tickets_test (`ticket_number`,`customer`,`date`,`description`,`order`,`job`,`driver_id`,`truck_number`,`hours`,`tons`,`rate`,`driver_rate`) VALUES (?)";
    const values = [98288, "JMF", "2022-09-21T05:00:00.000Z", "Plantt 1 / 0175A23112", "23112", "175", "IL", "304", 69, 32.09, 69, 69];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json("Invoice created successfully!");
    });
});

//runs backend server on localhost:5000
app.listen(5000, () =>{
    console.log("connected to backend!");
});