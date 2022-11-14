const mysql = require('mysql');
const config = require('./databaseconfig.json')

//connection to database
const connection = mysql.createConnection({
    host: config.RDS_HOSTNAME,
    user: config.RDS_USERNAME,
    password: config.RDS_PASSWORD,
    port: config.RDS_PORT 
});

 //query to query everything from the load_tickets_test table
const SQL_QUERY_TEST = "SELECT * FROM accounting.load_tickets_test";

//function for actual request with query on database, returns any error and its error message
//console logs resulting query.
connection.query(SQL_QUERY_TEST, (err, result, fields) => {
    if (err) {
        console.log("[ERROR] " + err.message);
        return;
    }

    console.log(result);
});

// connection.connect((err) => {
//     if (err) {
//         console.log('Database failed to connect' + err.stack);
//         return;
//     }
//     console.log('Connected to database');
// });

//ends database connection
connection.end();