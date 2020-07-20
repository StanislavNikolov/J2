const { spawn } = require('child_process');
const logger = require('./logger.js');

const startGrader = (subId) => {
	const process = spawn('python3', ['main.py', `${__dirname}/database.sqlite3`, subId], { cwd: `${__dirname}/pygrader` });

	//process.stdin.write(params.stdin);
	//process.stdin.end();

	let timeoutID = null;
	const timeout = 60; // in seconds

	process.stdout.on('data', (data) => { logger.verbose('grader stdout: ' + data.toString()) });
	process.stderr.on('data', (data) => { logger.verbose('grader stderr: ' + data.toString()) });

	process.on('exit', (exitCode, signal) => {
		logger.verbose('Grader exited')
		clearTimeout(timeoutID);
	});

	process.on('error', (data) => {
		logger.verbose("Grader process error -  maybe process couldn't be started", {details: data});
		clearTimeout(timeoutID);
	});

	timeoutID = setTimeout(() => {
		logger.verbose("Grader killed because of timeout");
		process.kill();
	}, timeout * 1000);
};

module.exports.startGrader = startGrader;
