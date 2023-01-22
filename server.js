const mysql = require('mysql'); //used to interact with mysql databases
require('dotenv').config();
const express = require('express'); //node package used to create backend server and api.
const nodemailer = require('nodemailer'); //node package used for sending emails
const cors = require('cors'); //needed to prevent cors error
const app = express();

const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.*\s).{8,32}$/;

//this uses nodemailer to send a email from truckmanagerservice@gmail.com
async function mail() {

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.OAUTH_USER,
            pass: process.env.OAUTH_PASS,
            clientId: process.env.OAUTH_CLIENT_ID,
            clientSecret: process.env.OAUTH_CLIENT_SECRET,
            refreshToken: process.env.OAUTH_REFRESH_TOKEN,
        },
    });

    const mailOptions = {
        from: 'truckmanagerservice@gmail.com',
        to: process.env.TEST_EMAIL,
        subject: 'Nodemailer Test Email',
        text: 'Email sent with nodemailer'
    }

    let info = await transporter.sendMail(mailOptions, (error, info) => {
        if(error) {console.log(error);}
        else {
            console.log("Email Sent!");
        }
    });
}
mail();

app.use(express.json())
app.use(cors({
    origin: '*' //temporary for development, this will eventually be the server where our app is hosted
}));

//database connection
const connection = mysql.createConnection({
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    port: process.env.RDS_PORT 
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

//this endpoint will check if a given username is present in the database
app.get("/validusername/:username", (req, res) => {
    const username = req.params.username;
    const q = `SELECT Username FROM Login.Login WHERE Username = "${username}" `;
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        if(result[0]) {
            return res.json({response: true});
        }
        else {
            return res.json({response: false});
        }
    })
})

//This will update the password in the database with the given username and new password
//NEED TO ENCRYPT PASSWORDS IN FUTURE
app.put("/forgotpassword", (req, res) => {
    const username = req.body.username;
    const newPassword = req.body.newPassword;
    if(!passwordRegex.test(newPassword)) {
        return res.json({response: false, errcode: 1}) //password does not meet requirements
    }
    const q = `UPDATE Login.Login SET Passcode = "${newPassword}" WHERE Username = "${username}"`;
    connection.query(q, (err, result) => {
        if (err) return res.json({response: false, errcode: 2}); //failed to update to database
        return res.json({response: true, errcode: 0}); //successful password change
    });
})

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
//this loops through the data returned from the database for a valid username
//if given valid username it checks for valid password.
//if there is a match it will return an json with response and accepted: true
//if neither match it returns json with data of 'invalid credentials' and accepted: false
//if users become large it will probably be more efficient to query the username and password and check if it was successful or not
//instead of pulling every user and password from the databae.
app.post("/login", (req, res) => {
    const q = "SELECT Username, Passcode FROM Login.Login";
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        const data = result
        for(let i = 0; i < data.length; i++) {
            if(data[i].Username === req.body.username) {
                if(data[i].Passcode === req.body.password) {
                    return res.json({response: 'valid credentials', accepted: true});
                }
            }
        }
        return res.json({response: 'invalid credentials', accepted: false});
    });
});

//creates new row in Login table
//req will be used to input query data once we have this connected to our front end
//for testing purposes we are using hardcoded values, sprint 6 will connect this to the front end
app.post("/logintest", (req, res) => {
    const q = "INSERT INTO Login.Login(`Employee_ID`, `Username`, `Passcode`, `Email`) VALUES (?)";
    const values = [1111, "test", "testpassword", "test@test.com"];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json("User created successfully!");
    });
});

//runs backend server on localhost:5000
app.listen(5000, () =>{
    console.log("connected to backend!");
});