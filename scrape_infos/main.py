import os
import sqlite3

conn = sqlite3.connect('../database.sqlite3')
# enable foreign keys https://cs.stanford.edu/people/widom/cs145/sqlite/SQLiteRefIntegrity.html
conn.cursor().execute("PRAGMA foreign_keys = ON;")

def add_test(prob_id, inp, sol):
	cur = conn.cursor()
	cur.execute("""
	INSERT INTO tests
	(problem_id, inp_contents, out_contents, memory_limit, time_limit, grading_type)
	VALUES
	(?, ?, ?, ?, 500, 'tokens')
	""", (prob_id, inp, sol, 256 * 1024 * 1024))
	conn.commit()

def add_to_db(db_name, tests_path, author_path):
	cur = conn.cursor()
	cur.execute('SELECT id FROM problems WHERE name = ?', (db_name,))
	prob_id = cur.fetchone()
	if prob_id == None: # not in db yet; create it
		cur.execute('INSERT INTO problems (name, user_visible) VALUES (?, true)', (db_name,))
		conn.commit()
		prob_id = cur.lastrowid
	else:
		prob_id = prob_id[0]

	print(prob_id)

	tests = {'in': {}, 'sol': {}}
	for filename in sorted(os.listdir(tests_path)):
		try:
			idx, ext = filename.split('.')[-2:]
			if ext == 'in':
				tests['in'][idx] = os.path.join(tests_path, filename)
			elif ext == 'sol':
				tests['sol'][idx] = os.path.join(tests_path, filename)
			else:
				print('Weird extension?', filename)

		except ValueError: # sometimes there are non test files in the test directory
			print('Not a test?', filename)

	ins  = set(tests['in'].keys())
	sols = set(tests['sol'].keys())
	both = set.intersection(ins, sols)

	if len(both) != len(ins) or len(both) != len(sols):
		print("There are different number of in and sol files?")

	cur.execute('SELECT COUNT(*) FROM tests WHERE problem_id = ?', (prob_id, ))
	inserted_cnt = cur.fetchone()[0]
	if inserted_cnt == len(both):
		print(db_name, prob_id, 'already inserted', len(both), 'tests')
		return

	if inserted_cnt != 0:
		print(db_name, prob_id, 'cleaning half assed tests')
		cur.execute('DELETE FROM tests WHERE problem_id = ?', (prob_id, ))
		conn.commit()

	for idx in sorted(both):
		with open(tests['in'][idx])  as f: inp = f.read()
		with open(tests['sol'][idx]) as f: sol = f.read()
		add_test(prob_id, inp, sol)

def execute(comp, problems, group, archve):
	print(comp, problems, group, archive)
	os.system(f"mkdir -p 'archives/{comp}'")
	os.system(f"cd 'archives/{comp}'; wget '{archive}' -nc -q -O '{group}.zip'")
	os.system(f"cd 'archives/{comp}'; unzip -q -n '{group}.zip' -d '{group}'")
	for dirpath, dirnames, filenames in os.walk(f"archives/{comp}/{group}"):
		if 'author' in dirnames and 'tests' in dirnames: # dirpath is a 'problem' directory
			raw_problem = dirpath.split(os.path.sep)[-1]
			problem_idx = int(raw_problem[0]) - 1
			problem_name_short = raw_problem.split('-')[1].strip()
			problem_name_full = problems[problem_idx]

			db_name = f'{comp}/{group}/{problem_idx+1} - {problem_name_full}'
			tests_path = os.path.join(dirpath, 'tests')
			author_path = os.path.join(dirpath, 'author')
			add_to_db(db_name, tests_path, author_path)

with open('src') as f:
	for line in [l.strip() for l in f.readlines()]:
		if len(line) == 0 or line[0] == '#': continue
		cmd, arg = line.split('=')

		if cmd == 'comp':
			current_comp = arg
		if cmd == 'n':
			curr_problems = [name.strip() for name in arg.split(',')]
		if cmd == 'g':
			curr_group = arg
		if cmd == 'a':
			archive = arg
			execute(current_comp, curr_problems, curr_group, archive)
