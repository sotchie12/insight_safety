const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');

const config = require('./config/config.json');
const router = require('./routes/route');
const controller_hub = require('./server_modules/controller_hub.js');


const app = express();

app.use(`${config.url_prefix}`, router);
app.use(logger('dev'));
app.use(bodyParser.json(config.json_uploaad_limit))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const queue_in = process.argv[2];

let main = async () => {
    await controller_hub.ceate_mysql_conn_HUB();
};


module.exports = app;
main();

app.listen(config.rest_api_port, function () {});