const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const app     = express();
const workers = require('./workers.js');

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
	console.log('Not admin', req.ip);
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
			res.json({error: 'database error'});
			console.log(`Database error: ${err}`);
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
	`;

	db.all(SQL, [req.params.subId], (err, rows) => {
		if(err) {
			res.json({error: 'database error'});
			console.log(`Database error (1): ${err}`);
			return;
		}

		const SQL = `
		SELECT E.id AS id, S.id AS sid, E.test_id, E.verdict, E.message
		FROM executions AS E
		JOIN submissions AS S ON E.submission_id = S.id
		WHERE ($1 IS NULL OR S.id = $1)
		ORDER BY E.submission_id
		`;

		const submissions = rows;

		db.all(SQL, [req.params.subId], (err, rows) => {
			if(err) {
				res.json({error: 'database error'});
				console.log(`Database error (2): ${err}`);
				return;
			}
			res.json({submissions: submissions, executions: rows});
		});
	});
});

app.post('/submit/:probId', (req, res) => {
	// safety checks
	try {
		if(req.body.code.length > 50000) {
			res.json({error: 'code too long'});
			return;
		}
	} catch {
		res.json({error: 'bad code'});
		return;
	}

	// TODO verify prob has user_visible
	// TODO rate limit

	const submitDate = new Date();

	const SQL = `
	INSERT INTO submissions
	(problem_id, ip, date, source_code)
	VALUES (?, ?, ?, ?)
	`;

	db.run(SQL, [req.params.probId, req.ip, submitDate, req.body.code], function(err) {
		if(err) {
			res.json({error: 'Database error'});
			console.log(`Database error: ${err}`);
			return;
		}

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
			res.send('Database error');
			console.log('Database error', err);
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
			res.send('Database error');
			console.log('Database error', err);
			return;
		}
		res.json(rows);
	});
});

app.post('/admin/set_state/:probId/:userVisible', adminOnly, (req, res) => {
	const SQL = 'UPDATE problems SET user_visible = ? WHERE id = ?';

	db.run(SQL, [req.params.userVisible, req.params.probId],  (err) => {
		if(err) {
			res.send('Database error');
			console.log('Database error', err);
			return;
		}
		res.json({error: null});
	});
});

let db = new sqlite3.Database('./database.sqlite3', (err) => {
	if(err) {
		console.error(err.message);
		return;
	}
	db.run('PRAGMA foreign_keys = ON;', [], (err) => {
		if(err) {
			console.error(err.message);
			return;
		}

		console.log('Connected to the database.');

		const port = process.env.port || 8080;
		app.listen(port, () => console.log(`Listening on port ${port}!`));
	});
});
