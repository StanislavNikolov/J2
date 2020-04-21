import sqlite3
import tempfile
import subprocess
import os, sys
import time
import shutil
import graders
import re

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
		try:
			cmd = ['firejail', '--noprofile',
					'--private', '--net=none', '--noroot', '--seccomp', '--shell=none',
					f'--rlimit-as={meml}', './sol']

			MAX_SANDBOX_OVERHEAD = 0.1

			begin = time.time()
			solproc = subprocess.run(cmd,
					input = inp.encode(),
					timeout = timel / 1000 + MAX_SANDBOX_OVERHEAD,
					capture_output = True,
					shell = False,
					env = None)
			end = time.time()

			ugly_sandbox_overhead = re.search('[0-9]*.[0-9]* ms', solproc.stderr.decode()).group()
			sandbox_overhead = float(ugly_sandbox_overhead[:-3])

			if end - begin - sandbox_overhead > timel:
				record_execution(tid, 'TL', None)
		except subprocess.TimeoutExpired:
			# timed out
			record_execution(tid, 'TL', None)
			return

		# crashed
		if solproc.returncode != 0:
			record_execution(tid, 'RE', None)
			return

		# https://github.com/netblue30/firejail/blob/6f3867fdb8cdaca3ffd62eb824c10d42a5250c9c/src/firejail/env.c#L162
		# firejail spams stdout with useless shit. --quiet stops it, but stops usefull overhead data too!
		spam = b'\x1b]0;firejail ./sol \x07'
		user_output = solproc.stdout[len(spam):].decode() # remove firejail request to terminal to change window title

		# check output
		if grading_type not in graders.graders:
			record_execution(tid, 'GA', None)
			print('UNSUPORTED GRADING TYPE', grading_type)
			return

		if graders.graders[grading_type](out, user_output):
			record_execution(tid, 'OK', None)
			return
		else:
			record_execution(tid, 'WA', None)
			return

		record_execution(tid, 'OK', '')

	for tid, inp, out, meml, timel, grading_type in cur.fetchall():
		try:
			run_test(tid, inp, out, meml, timel, grading_type)
		except Exception as error:
			import traceback
			traceback.print_exc()
			print('ERROR', error)
			record_execution(tid, 'GE', None)

judge()

shutil.rmtree(workdir)

# mark judged
cur.execute("UPDATE submissions SET judged = true  WHERE id = ?", (subId,))
conn.commit()
