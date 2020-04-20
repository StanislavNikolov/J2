const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const app     = express();

app.set('view engine', 'pug'); // res.render
app.use(express.json()); // req.body
app.use(express.urlencoded({ extended: true }))
app.use(express.static('client/'));

app.get('/problems', (req, res) => {
	const SQL = `SELECT id, name FROM problems WHERE user_visible = true`;
	db.all(SQL, [], (err, rows) => {
		if (err) {
			res.json({error: 'database error'});
			console.log(`Database error: ${err}`);
			return;
		}

		res.json(rows);
	});
});

app.get('/submissions', (req, res) => {
	const SQL = `
	SELECT submissions.id AS sid, problems.id AS pid, submissions.date
	FROM   submissions
	JOIN   problems on submissions.problem_id = problems.id
	WHERE  problems.user_visible = true
	`;
	db.all(SQL, [], (err, rows) => {
		if (err) {
			res.json({error: 'database error'});
			console.log(`Database error: ${err}`);
			return;
		}

		console.log(rows);
		res.json(rows);
	});
});

app.post('/submit/:probId', (req, res) => {
	console.log(req.body);

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

	// TODO verify prob_id
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
		res.json({id: this.lastID});
	});
});

let db = new sqlite3.Database('./database.sqlite3', (err) => {
	if (err) {
		console.error(err.message);
	}

	console.log('Connected to the database.');

	const port = process.env.port || 8080;
	app.listen(port, () => {
		console.log(`Listening on port ${port}!`)
	});
});
