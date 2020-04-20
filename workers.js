const { spawn } = require('child_process');

const startGrader = (subId) => {
	const process = spawn('python3', ['main.py', `${__dirname}/database.sqlite3`, subId], { cwd: `${__dirname}/pygrader` });

	//process.stdin.write(params.stdin);
	//process.stdin.end();

	let timeoutID = null;
	const timeout = 60; // in seconds

	process.stdout.on('data', (data) => { console.log('grader:', data.toString()); });
	process.stderr.on('data', (data) => { console.log('grader:', data.toString()); });

	process.on('exit', (exitCode, signal) => {
		console.log('Grader exited');
		clearTimeout(timeoutID);
	});

	process.on('error', (data) => {
		console.log('Maybe process couldnt be started?', {errordata: data});
		clearTimeout(timeoutID);
	});

	timeoutID = setTimeout(() => {
		console.log('Grader killed because of timeout');
		process.kill();
	}, timeout * 1000);
};

module.exports.startGrader = startGrader;
