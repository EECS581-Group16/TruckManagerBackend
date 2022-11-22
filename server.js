const mysql = require('mysql'); //used to interact with mysql databases
const config = require('./databaseconfig.json') //configuration file that contains sensitive database login information
const express = require('express'); //node package used to create backend server and api.
const cors = require('cors'); //needed to prevent cors error
const app = express();

app.use(express.json())
app.use(cors({
    origin: '*' //temporary for development, this will eventually be the server where our app is hosted
}));

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

//posts new data into database
//TODO: figure out what to do with "null" values
app.post("/invoices", (req, res) => {
    const q = "INSERT INTO accounting.load_tickets_test (`ticket_number`,`customer`,`date`,`description`,`order`,`job`,`driver_id`,`truck_number`,`hours`,`tons`,`rate`,`driver_rate`) VALUES (?)";
    const values = [
        req.body.ticketNum, 
        "null", 
        req.body.date, 
        req.body.description, 
        req.body.orderNum, 
        "null", 
        req.body.driver, 
        req.body.truckNum, 
        req.body.hours, 
        req.body.tons, 
        req.body.unitPrice, 
        0
    ];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json("Invoice created successfully!");
    });
});

app.get("/loginData", (req, res) => {
    const q = "SELECT * FROM Login.Login;"; //retrieves every entry in login table
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

//this is beginning of testing for correct username and password.
//for testing purposes this loops through the data returned from the database for a valid username
//if given valid username it checks for valid password.
//if neither match it returns json with data of 'invalid credentials'
app.get("/login", (req, res) => {
    const q = "SELECT Username, Passcode FROM Login.Login";
    //const values = ["admin", "password"];
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        const data = result
        for(let i = 0; i < data.length; i++) {
            if(data[i].Username == "admin") {
                if(data[i].Passcode == "password") {
                    return res.json(data[i]);
                }
            }
        }
        return res.json('invalid credentials');
    });
});

//creates new row in Login table
//req will be used to input query data once we have this connected to our front end
//for testing purposes we are using hardcoded values, sprint 6 will connect this to the front end
app.post("/login", (req, res) => {
    const q = "INSERT INTO Login.Login(`Employee_ID`, `Username`, `Passcode`, `Email`) VALUES (?)";
    const values = [1234, "admin", "password", "admin@admin.com"];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json("User created successfully!");
    });
});

//runs backend server on localhost:5000
app.listen(5000, () =>{
    console.log("connected to backend!");
});