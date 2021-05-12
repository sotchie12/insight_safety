/**
 * External library
 */
const winston = require('winston');
//const moment = require('moment');
const path = require("path");
/**
 * Internal library
 */
const server_config = require("../config/config.json");

require("winston-daily-rotate-file");
//require("./winston_mqtt.js").MqttTransport;

const WinstonGraylog2 = require("winston-graylog2");

let log_obj = {};

// Set up 1st stage of configurations
module.exports = {
    //Used in multiple scripts
    SERVER_LOGGING: function(file_path, option) {
        if (!option) { option = {}; }
        if (!option.level) { option.level = 'info'; }
        //Unified logging module.
        log_obj = winston.createLogger({
            format: winston.format.combine(
                //winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.label({ label: process.pid }),
                winston.format.json(),
                //winston.format.prettyPrint(),
                // winston.format.printf(({ level, message, label, timestamp }) => {
                //   return moment(timestamp).utc().local().format('MMMM Do YYYY, h:mm:ss a');
                // }),
            ),
            transports: [
                new winston.transports.DailyRotateFile({
                    level: option.level,
                    filename: file_path,
                    datePattern: undefined, //ISO 8601
                    handleExceptions: true,
                    maxsize: server_config.log_options._iLOG_FILE_MAXSIZE, //4MB
                    maxFiles: server_config.log_options._iLOG_FILE_COUNT,
                }),
                new winston.transports.Console({
                    level: option.level,
                    handleExceptions: true,
                }),
                new WinstonGraylog2({
                    name: file_path.replace(server_config.log_options.LOG_PATH, ""),
                    level: option.level,
                    handleExceptions: true,
                    graylog: server_config.graylog
                })
            ],
            exitOnError: false
        });
        if (option.mute_console) { log_obj.remove(winston.transports.Console); }
        if (option.add_mqtt) {
            log_obj.add(winston.transports.MqttTransport, {
                name: __dirname ? path.basename(__dirname) : "undefined",
                topic: server_config.log_options.sMQTTRemoteLogTopic,
                host: server_config.log_options.sMQTTRemoteLogHost,
                //level: option.level
            });
        }
        return log_obj;
    },
    log_obj: log_obj
};

//Set up 2nd stage of configurations. Most of them are based from above.