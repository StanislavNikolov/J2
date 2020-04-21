-- schema
CREATE TABLE problems (
	id INTEGER NOT NULL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	checker_code TEXT,
	statement_code TEXT, -- the bytes/text of the statement file
	statement_type TEXT, -- PDF, HTML, URL, markdown or plaintext
	user_visible BOOLEAN NOT NULL -- should be hidden from users if false
);

CREATE TABLE submissions (
	id INTEGER NOT NULL PRIMARY KEY,
	problem_id INTEGER NOT NULL,
	judged BOOLEAN NOT NULL DEFAULT FALSE,
	user_key TEXT,
	date DATE NOT NULL,
	ip TEXT,
	source_code TEXT NOT NULL,
	FOREIGN KEY (problem_id) REFERENCES problems (id)
);

CREATE TABLE tests (
	id INTEGER NOT NULL PRIMARY KEY,
	problem_id INTEGER NOT NULL,
	inp_contents TEXT, -- visible to solution and checker
	out_contents TEXT, -- visible to checker only
	memory_limit INTEGER NOT NULL, -- in bytes
	time_limit float NOT NULL, -- in miliseconds
	grading_type TEXT NOT NULL, -- tokens, floats, strings, custom_checker
	FOREIGN KEY (problem_id) REFERENCES problems (id)
);

CREATE TABLE executions (
	id INTEGER NOT NULL PRIMARY KEY,
	submission_id INTEGER NOT NULL,
	test_id INTEGER, -- -1 when the execution is of 'prepare' type - compilation, syntax check
	date DATE NOT NULL,
	verdict TEXT, -- OK, WA, RE, ML, TL, CE/CS (compile error/success), CC (checker crashed)
	message TEXT, -- detailed message from checker
	FOREIGN KEY (submission_id) REFERENCES submissions (id)
);

-- test data
--INSERT INTO problems (name, user_visible) VALUES ("1) Heap sort",           true);
--INSERT INTO problems (name, user_visible) VALUES ("2) Olimp 2020 A3 sheep", true);
--INSERT INTO problems (name, user_visible) VALUES ("prob 3",                 false);
--INSERT INTO tests    (problem_id, inp_contents, out_contents, memory_limit, time_limit, grading_type)
       --VALUES        (1, "3 3 1 2", "1 2 3", 1000000, 1000, "ints");
--INSERT INTO tests    (problem_id, inp_contents, out_contents, memory_limit, time_limit, grading_type)
       --VALUES        (1, "4 3 1 2 9", "1 2 3 9", 1000000, 1000, "ints");
