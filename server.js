/*
-Author: Mason Otto
-Name: server.js
-Description: This is the backend API that includes all of the endpoints for communication
    between the front end and database.
*/

/*-------------------------------------------------------------------
    Import dependencies
-------------------------------------------------------------------*/
const mysql = require('mysql'); //used to interact with mysql databases
require('dotenv').config(); //dotenv for use with npm, protects sensitive information
const express = require('express'); //node package used to create backend server and api.
const nodemailer = require('nodemailer'); //node package used for sending emails
const cors = require('cors'); //needed to prevent cors error
const crypto = require('crypto');
const bcrypt = require("bcryptjs"); //used for hashing and encrypting data

const SALT = 10; //salt for hashing
const ALGORITHM = "aes-256-cbc"; //algorithm for encryption
const inVecString = [0x9f, 0x32, 0x11, 0xc9, 0x44, 0x3c, 0x5a, 0x34, 0x08, 0xac, 0x0e, 0x6d, 0xcc, 0xb7, 0x5a, 0x83];
const secKeyString = [0x40 ,0xda ,0x60 ,0x0b ,0xde ,0x7c ,0x4c ,0xb0 ,0x45 ,0x81 ,0xbe ,0x6e ,0xdf ,0x4b ,0x4b ,0xb4 ,0x63 ,0xe9 ,0xd6 ,0x1f ,0x35 ,0xcc ,0x76 ,0x0c ,0xc8 ,0xa5 ,0xb7 ,0x62 ,0x35 ,0xcf ,0xd2 ,0x37];
const INVEC = Buffer.from(inVecString, 'utf-8');
const SECKEY = Buffer.from(secKeyString, 'utf-8');

/*-------------------------------------------------------------------
    Constants
-------------------------------------------------------------------*/
const app = express(); //creates the app express.js object which handles requests
const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.*\s).{8,32}$/;

/*-------------------------------------------------------------------
    Database connection

    Connects to mysql using protected credentials stored in
    .env file
-------------------------------------------------------------------*/
const connection = mysql.createConnection({
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    port: process.env.RDS_PORT 
});

/*-------------------------------------------------------------------
    Functions
-------------------------------------------------------------------*/
//this uses nodemailer to send a email from truckmanagerservice@gmail.com
async function mail(email, otp) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: 'truckmanagerservice@gmail.com',
        to: email,
        subject: 'Reset Password Request OTP',
        html: `<p>Your One Time Pin is <b>${otp}</b>. Use this to reset your password.<p>`
    }

    let info = await transporter.sendMail(mailOptions, (error, info) => {
        if(error) {console.log(error);}
        else {
            console.log("Email Sent!");
        }
    });
}

/*
-Author: Mason Otto
-Last Modified: 2/1/2023
-Description: This will check the database to make sure that we are not registering a user that already exists.
-Returns: JSON response - status of duplicate user or not
-TODO: everything
*/
async function validateNewUser(user) {
    const username = user;
    const q = `SELECT Username FROM Login.Login WHERE Username = "${username}" `;
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        if(result[0]) {
            return false;
        }
        return true;
    })
}

/*-------------------------------------------------------------------
    Configure Express.js

    Express.js handles GET, POST, PUT, etc... requests to the
    backend, and does so through the app object via the corresponding
    methods. When making a request through the app object, you
    include a callback function with a request and response object.
    The request object includes any data that the user provides which
    may be relevant to a query. The response object handles the response
    which is returned to the client, which in our case is usually parsed
    JSON data which can be used as a javascript object.

    Ex:
    
    app.post("/", (req, res) => {
        const username = req.body.username;
    });

    This would handle a post request to the "/" or base directory
    and would assign username information provided by the user to
    the variable username.
-------------------------------------------------------------------*/
app.use(express.json());

/*-------------------------------------------------------------------
    Configure CORS (Cross-Origin Resource Sharing)

    This is middleware for Express.js, it determines what origin's
    to accept requests from by setting the Access-Control-Allow-Origin
    header in the response. This is currently set to "*" for
    purposes of development, to allow requests from any origin.
-------------------------------------------------------------------*/
app.use(cors({
    origin: '*' //temporary for development, this will eventually be the server where our app is hosted
}));

/*-------------------------------------------------------------------
    Backend Endpoints

    These include GET, POST, PUT, etc... requests that send
    information to or retrieve information from the database.
    This is the meat of the backend.
-------------------------------------------------------------------*/
app.get("/", (req, res) => {
    res.json("hello this is the backend");
});

//returns all invoices tables
app.get("/invoices", (req, res) => {
    const q = "SELECT * FROM accounting.load_tickets_test";
    //const q = "SELECT * FROM accounting.load_tickets";
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

/*
-Author: Mason Otto
-Last Modified: 2/1/2023 -Mason Otto
-Description: This will set an OTP in the SQL database for the user that requested
    it. Then it will send that OTP to the email that user has stored in 
    the database.
-Returns: JSON response - status of email sent
-TODO: Give OTP an expiration.
*/
app.put("/requestotp", (req, res) => {
    const username = req.body.username;
    const OTP = Math.floor(100000 + Math.random() * 900000);
    const q = `SELECT Email FROM Login.Login WHERE Username = "${username}" `;
    const q2 = `UPDATE Login.Login SET OTP = ${OTP} WHERE Username = "${username}"`;
    connection.query(q2, (err, result) => {
        if(err) return res.json(err);
        connection.query(q, (err, result) => {
            if(err) return res.json(err);
            if(result[0]) {
                const decipherText = crypto.createDecipheriv(ALGORITHM, SECKEY, INVEC);
                let decryptedEmail = decipherText.update(result[0].Email, "hex", "utf-8");
                decryptedEmail += decipherText.final("utf8");
                console.log(decryptedEmail);
                mail(decryptedEmail, OTP);
                return res.json({response: "EMAIL SENT", email: decryptedEmail});
            }
            else {
                return res.json({response: "EMAIL FAILED"});
            }
        });
    });
    
})

/*
-Author: Mason Otto
-Last Modified: 1/23/2023
-Description: This will take in the user input OTP and their username to verify if the OTP is correct.
    If correct then it will allow the user to update their password. 
-Returns: JSON response - status of OTP verification
-TODO: Figure out some way to determine if OTP has expired.
*/
app.put("/verifyotp", (req, res) => {
    const username = req.body.username;
    const OTP = parseInt(req.body.otp);
    const q = `SELECT OTP FROM Login.Login WHERE Username = "${username}"`;
    connection.query(q, (err, result) => {
        if(err) return res.json(err);
        if(result[0]) {
            if (OTP === parseInt(result[0].OTP)) {
                return res.json({response: "VERIFIED"});
            }
            else {
                return res.json({response: "FAILED"});
            }
        }
        else {
            return res.json({response: "FAILED"});
        }
    });
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
        return res.json({created: true});
    });
});

/*
-Author: Ryan Penrod
-Last Modified: 2/1/2023 - Mason Otto
-Description: This create a new row on the Login table
    for a user given the information they provided
-Returns: JSON response - status account creation
-TODO: Consider all fields
*/
app.post("/register", async (req, res) => {

    //The following statement will hash the passcode
    const hashedPassword = await bcrypt.hash(req.body.passcode, SALT);
    
    //The following will encrypt the email
    const cipherText = crypto.createCipheriv(ALGORITHM, SECKEY, INVEC);
    let encryptedEmail = cipherText.update(req.body.email, "utf-8", "hex");
    encryptedEmail += cipherText.final("hex");


    const q = "INSERT INTO Login.Login (`Employee_ID`,`Username`,`Passcode`,`Email`,`OTP`,`Verified`,`Account_Type`,`Security_Question1`,`Q1_Answer`,`Security_Question2`,`Q2_Answer`) VALUES (?)";
    const values = [
        req.body.employeeId, 
        req.body.username, 
        hashedPassword, 
        encryptedEmail, 
        "null", 
        0, 
        "null", 
        "null", 
        "null", 
        "null", 
        "null"
    ];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json("Account created successfully!");
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
app.post("/login", async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, SALT);
    const q = "SELECT Username, Passcode FROM Login.Login";
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        const data = result
        for(let i = 0; i < data.length; i++) {
            if(data[i].Username === req.body.username) {
                if(bcrypt.compare(data[i].Passcode, hashedPassword)) {
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

/*-------------------------------------------------------------------
    Start server 
    
    Start server and listen for requests on port 5000
    (localhost:5000 - worth noting this is not always the same
    as the url which npm generates, but is always the correct url
    for Thunder Client). When the server is successfully started, log
    message "connected to backend!" to console. 
-------------------------------------------------------------------*/
app.listen(5000, () =>{
    console.log("connected to backend!");
});