const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const app     = express();
const workers = require('./workers.js');
const logger  = require('./logger.js');

app.set('view engine', 'pug'); // res.render
app.use(express.json()); // req.body
app.use(express.urlencoded({ extended: true }))
app.use(express.static('client/'));
app.use(express.static('node_modules/semantic-ui-offline/'));

const adminOnly = (req, res, next) => {
	if(req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
		next();
		return;
	}
	logger.log('verbose', 'External IP tried to open admin interface', {details: req.ip});
	res.send('Not allowed');
};

app.get('/problems', (req, res) => {
	const SQL = `
	SELECT id, name, statement_type
	FROM problems
	WHERE user_visible = true
	ORDER BY name`;
	db.all(SQL, [], (err, rows) => {
		if (err) {
			logger.warn('Database error', {details: err});
			res.json({error: 'database error'});
			return;
		}

		res.json(rows);
	});
});

/*
app.get('/submissions', (req, res) => {
	const SQL = `
	SELECT submissions.id AS sid, problems.id AS pid, submissions.date
	FROM   submissions
	JOIN   problems on submissions.problem_id = problems.id
	WHERE  problems.user_visible = true
	LIMIT  5
	`;
	db.all(SQL, [], (err, rows) => {
		if(err) {
			res.json({error: 'database error'});
			console.log(`Database error: ${err}`);
			return;
		}

		console.log(rows);
		res.json(rows);
	});
});
*/

app.get('/submissions/:subId', (req, res) => {
	if(req.params.subId === 'all') {
		req.params.subId = null;
	}

	const userKey = req.headers['x-user-key'];

	// get basic submission metadata
	const SQL = `
	SELECT id, problem_id, date, judged,
	       (
	        SELECT COUNT(*)
	        FROM executions
	        WHERE executions.submission_id = submissions.id
	          AND verdict = 'OK'
	       ) * 100.0 /
	       (
	        SELECT COUNT(*)
	        FROM tests
	        WHERE tests.problem_id = submissions.problem_id
	       ) AS score
	FROM   submissions
	WHERE  ($1 IS NULL OR id = $1)
	   AND user_key = $2
	`;

	db.all(SQL, [req.params.subId, userKey], (err, rows) => {
		if(err) {
			logger.warn('Database error (submissions/, 1)', {details: {dberr: err, user_key: userKey}});
			res.json({error: 'database error'});
			return;
		}

		const SQL = `
		SELECT E.id AS id, S.id AS sid, E.test_id, E.verdict, E.message
		FROM executions AS E
		JOIN submissions AS S ON E.submission_id = S.id
		WHERE ($1 IS NULL OR S.id = $1) AND S.user_key = $2
		ORDER BY E.submission_id
		`;

		const submissions = rows;

		db.all(SQL, [req.params.subId, userKey], (err, rows) => {
			if(err) {
				logger.warn('Database error (submissions/, 2)', {details: {dberr: err, user_key: userKey}});
				res.json({error: 'database error'});
				return;
			}
			res.json({submissions: submissions, executions: rows});
		});
	});
});

app.get('/standings', (req, res) => {
});

app.post('/submit/:probId', (req, res) => {
	const userKey = req.headers['x-user-key'];

	// safety checks
	try {
		if(req.body.code.length > 50000) {
			logger.info("Denied solution - code above maximum allowed length", {details: {user_key: userKey}});
			res.json({error: 'code too long'});
			return;
		}
	} catch {
		logger.info("Denied solution - invalid? code", {details: {user_key: userKey}});
		res.json({error: 'bad code'});
		return;
	}

	// TODO verify prob has user_visible
	// TODO rate limit

	const submitDate = new Date();

	const SQL = `
	INSERT INTO submissions
	(problem_id, date, source_code, ip, user_key)
	VALUES (?, ?, ?, ?, ?)
	`;

	const params = [req.params.probId, submitDate, req.body.code, req.ip, userKey];
	db.run(SQL, params, function(err) {
		if(err) {
			logger.warn('Database error (submit/)', {details: {dberr: err, user_key: userKey}});
			res.json({error: 'Database error'});
			return;
		}

		logger.info("Accepted solution", {details: {user_key: userKey}});

		// start worker
		workers.startGrader(this.lastID);

		res.json({id: this.lastID});
	});
});

app.get('/statement/:probId', (req, res) => {
	let probId = req.params.probId;
	if(probId.endsWith('.pdf')) {
		probId = probId.slice(0, -4);
	}

	const SQL = 'SELECT statement_code, statement_type FROM problems WHERE id = ?';
	db.all(SQL, [probId], (err, rows) => {
		if(err) {
			logger.warn('Database error (statement/)', {details: {dberr: err, prob_id: probId}});
			res.send('Database error');
			return;
		}
		if(rows[0].statement_type === 'PDF') res.set('content-type', 'application/pdf');
		if(rows[0].statement_type === 'HTML') res.set('content-type', 'text/html');
		res.send(rows[0].statement_code);
	});
});

app.get('/admin',         adminOnly, (req, res) => res.sendFile('admin/index.html', {root: __dirname}));
app.get('/admin/app.css', adminOnly, (req, res) => res.sendFile('admin/app.css'   , {root: __dirname}));
app.get('/admin/app.js',  adminOnly, (req, res) => res.sendFile('admin/app.js'    , {root: __dirname}));

app.get('/admin/problems', adminOnly, (req, res) => {
	const SQL = 'SELECT id, name, user_visible FROM problems ORDER BY name';
	db.all(SQL, [], (err, rows) => {
		if(err) {
			logger.warn('Database error (admin/problems/)', {details: {dberr: err}});
			res.send('Database error');
			return;
		}
		res.json(rows);
	});
});

app.post('/admin/set_state/:probId/:userVisible', adminOnly, (req, res) => {
	const SQL = 'UPDATE problems SET user_visible = ? WHERE id = ?';

	db.run(SQL, [req.params.userVisible, req.params.probId],  (err) => {
		if(err) {
			logger.warn('Database error (admin/set_state/)', {details: {dberr: err, req_params: req.params}});
			res.send('Database error');
			return;
		}
		res.json({error: null});
	});
});

let db = new sqlite3.Database('./database.sqlite3', (err) => {
	if(err) {
		logger.error("Couldn't connect to database");
		return;
	}

	// enable foreign keys https://cs.stanford.edu/people/widom/cs145/sqlite/SQLiteRefIntegrity.html
	db.run('PRAGMA foreign_keys = ON;', [], (err) => {
		if(err) {
			logger.error("Couldn't set foreign_keys=ON after connecting to the database");
			return;
		}

		logger.info('Connected to the database.');

		const port = process.env.port || 8080;
		app.listen(port, () => {
			console.log(`
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
        ┃    User interface:  http://localhost:${port}          ┃
        ┃    Admin interface: http://localhost:${port}/admin    ┃
        ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
			`);
		});
	});
});
