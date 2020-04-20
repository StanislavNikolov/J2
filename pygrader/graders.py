graders = {}

def tokenify(string):
	return list(filter(lambda s: len(s) > 0,
		string.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ').split(' ')))

def tokens(corr, sol):
	tcorr = tokenify(corr)
	tsol = tokenify(sol)

	if len(tsol) != len(tcorr): return False

	for t1, t2 in zip(tcorr, tsol):
		if t1 != t2: return False

	return True

graders['tokens'] = tokens
