-- schema
CREATE TABLE problems (
	id INTEGER NOT NULL PRIMARY KEY,
	name TEXT NOT NULL,
	grading_type TEXT NOT NULL, -- ints, floats, strings, custom_checker
	checker_code TEXT,
	user_visible BOOLEAN NOT NULL -- should be hidden from users if false
);

CREATE TABLE submissions (
	id INTEGER NOT NULL PRIMARY KEY,
	problem_id INTEGER NOT NULL,
	date DATE NOT NULL,
	ip TEXT,
	source_code TEXT NOT NULL,
	-- TODO ??? source_code_compile_message
	FOREIGN KEY (problem_id) REFERENCES problems (id)
);

CREATE TABLE tests (
	id INTEGER NOT NULL PRIMARY KEY,
	problem_id INTEGER NOT NULL,
	inp_contents TEXT, -- visible to solution and checker
	out_contents TEXT, -- visible to checker only
	memory_limit INTEGER NOT NULL, -- in bytes
	time_limit float NOT NULL, -- in seconds
	FOREIGN KEY (problem_id) REFERENCES problems (id)
);

CREATE TABLE execution (
	id INTEGER NOT NULL PRIMARY KEY,
	submission_id INTEGER NOT NULL,
	test_id INTEGER, -- -1 when the execution is of 'prepare' type - compilation, syntax check
	date DATE NOT NULL,
	verdict TEXT, -- OK, WA, RE, TL, CC (checker crashed)
	message TEXT, -- detailed message from checker
	FOREIGN KEY (submission_id) REFERENCES submissions (id)
	FOREIGN KEY (test_id) REFERENCES tests (id)
);

-- test data
INSERT INTO problems (name, grading_type, user_visible) VALUES ("1) Heap sort",           "ints", true);
INSERT INTO problems (name, grading_type, user_visible) VALUES ("2) Olimp 2020 A3 sheep", "ints", true);
INSERT INTO problems (name, grading_type, user_visible) VALUES ("prob 3",                 "ints", false);
