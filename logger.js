/* Example usage:
 * logger.verbose('Fixed string message for easy grepping', {details: {a: 12, error: ...}});
 *
 * Log levels:
 * https://github.com/winstonjs/winston#logging-levels
 * error:   0
 * warn:    1
 * info:    2
 * http:    3
 * verbose: 4
 * debug:   5
 * silly:   6
 */

const {createLogger, format, transports} = require('winston');

const alignedWithColorsAndTime = format.combine(
	format.timestamp({
		format: 'YYYY-MM-DD HH:mm:ss.ms'
	}),
	format.colorize(),
	format.timestamp(),
	format.align(),
	format.printf(info => {
		const details = info.details != null ? ` ; ${JSON.stringify(info.details)}` : '';
		return `[${info.timestamp}] ${info.level}: ${info.message}${details}`
	})
);

const logger = createLogger({
	transports: [
		new transports.Console({
			format: alignedWithColorsAndTime,
			level: process.env.NODE_ENV === 'dev' ? 'silly' : 'info'
		}),
		new transports.File({
			filename: 'log.txt',
			level: 'silly',
			format: format.combine(format.timestamp(), format.json())
		})
	],
});

module.exports = logger;
