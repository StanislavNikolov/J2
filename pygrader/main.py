import sqlite3
import tempfile
import subprocess
import os, sys
import time
import shutil
import graders

db = sys.argv[1]
subId = sys.argv[2]
print(f'Starting grader for db={db} and subId={subId}')

conn = sqlite3.connect(db)
# enable foreign keys https://cs.stanford.edu/people/widom/cs145/sqlite/SQLiteRefIntegrity.html
conn.cursor().execute("PRAGMA foreign_keys = ON;")

# fetch source code from db
cur = conn.cursor()
cur.execute('SELECT source_code FROM submissions WHERE id = ?', (subId,))
source_code = cur.fetchone()[0]

def record_execution(test_id, verdict, message):
	cur.execute(" \
		INSERT INTO executions (submission_id, date, test_id, verdict, message) \
		VALUES (?, ?, ?, ?, ?)",
		(subId, time.time(), test_id, verdict, message))

	conn.commit()

# get tmp directory to work in
workdir = tempfile.mkdtemp()
os.chdir(workdir)

def judge():
	# write source code in tmpdir
	with open('sol.cpp', 'w') as f:
		f.write(source_code)

	# compile solution
	cc_flags = '-O2 -DONLINE_JUDGE'
	cc = 'g++' # TODO in windows

	cmd = [cc, '-O2', '-DONLINE_JUDGE', 'sol.cpp', '-o', 'sol']

	cc_process = subprocess.run(cmd, timeout = 5, capture_output = True)
	if cc_process.returncode != 0: # compilation failed
		record_execution(-1, 'CE', cc_process.stderr)
		return
	else:
		record_execution(-1, 'CS', '')

	# get all the tests than need to be executed
	cur.execute("""
			SELECT    T.id, T.inp_contents, T.out_contents, T.memory_limit, T.time_limit, T.grading_type
			FROM      tests AS T
			LEFT JOIN submissions AS S ON T.problem_id = S.problem_id
			WHERE     S.id = ?
			""", (subId,))

	def run_test(tid, inp, out, meml, timel, grading_type):
		# TODO memory limit

		try:
			solproc = subprocess.run(['./sol'],
					input = inp.encode(),
					timeout = timel / 1000,
					capture_output = True,
					env = None)
		except subprocess.TimeoutExpired:
			# timed out
			record_execution(tid, 'TL', None)
			return

		# crashed
		if solproc.returncode != 0:
			record_execution(tid, 'RE', solproc.stderr)
			return

		# check output
		if grading_type not in graders.graders:
			record_execution(tid, 'WA', solproc.stderr)
			print('UNSUPORTED GRADING TYPE', grading_type)
			return

		if graders.graders[grading_type](out, solproc.stdout.decode()):
			record_execution(tid, 'OK', solproc.stderr)
			return
		else:
			record_execution(tid, 'WA', solproc.stderr)
			return

		record_execution(tid, 'OK', '')

	for tid, inp, out, meml, timel, grading_type in cur.fetchall():
		print(f'test {tid}', flush = True)
		try:
			run_test(tid, inp, out, meml, timel, grading_type)
		except Exception as error:
			print('ERROR', error)
			record_execution(tid, 'GE', None)

judge()

shutil.rmtree(workdir)

# mark judged
cur.execute("UPDATE submissions SET judged = true  WHERE id = ?", (subId,))
conn.commit()
