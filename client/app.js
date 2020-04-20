const problemListEl = document.getElementById('problist');
const sbmTableEl  = document.getElementById('submissionsList').getElementsByTagName('tbody')[0];
const sbmBtnEl    = document.getElementById('submit');
const codeinputEl = document.getElementById('codeinput');

let problems = [];
let submissions = [];

let selectedProbEl = null;

const markSelected = (el) => {
	// unselect all problems
	for(const probEl of problemListEl.getElementsByClassName('problem')) {
		probEl.classList.remove('selected');
	}

	selectedProbEl = el;
	el.classList.add('selected');
};

const watchSubmissionForUpdates = (subId, el) => {
	const poll = () => {
		fetch(`/submissions/${subId}`)
		.then(resp => resp.json())
		.then(data => {
			console.log(data);
			const newEl = renderSubmission(data.submissions[0], data.executions);
			console.log(el.parentNode);
			el.parentNode.replaceChild(newEl, el);
			el = newEl;
			if(data.submissions[0].judged !== 0) return;
			setTimeout(poll, 50);
		});
	};
	poll();
};

sbmBtnEl.onclick = () => {
	if(selectedProbEl == null) {
		// TODO user feedback
		return;
	}

	const placeholderHTML = `<tr class='ui placeholder'><td colspan=4>Submitting...</td></tr>`;
	const template = document.createElement('template');
	template.innerHTML = placeholderHTML;
	const placeholderEl = template.content.firstChild;

	sbmTableEl.prepend(placeholderEl);

	const probId = selectedProbEl.id.substring(2);
	fetch(`/submit/${probId}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({code: codeinputEl.value, problem: selectedProbEl.id})
	})
	.then(resp => resp.json())
	.then(data => {
		console.log(data.id);
		watchSubmissionForUpdates(data.id, placeholderEl);
	});
};

const renderProblemList = () => {
	let first = true;
	for(const prob of problems) {
		const el = document.createElement('div')
		problemListEl.appendChild(el);

		el.classList.add('problem');
		el.id = 'p$' + prob.id;
		el.innerText = prob.name;
		el.onclick = () => markSelected(el);

		if(first) {
			markSelected(el);
			first = false;
		}
	}
};

const renderExecution = (exec) => {
	const el = document.createElement('span');
	if(exec.verdict === 'CS') return el;

	el.classList.add('execution');
	if(exec.verdict === 'OK') el.classList.add('good');
	else                      el.classList.add('bad');

	el.innerHTML = `${exec.verdict}`;
	return el;
};

const renderSubmission = (sbm, executions) => {
	const el = document.createElement('tr')

	el.classList.add('submission');
	el.id = 's$' + sbm.id;

	// show animation if more executions are expected to come
	if(sbm.judged === 0) el.classList.add('ui', 'placeholder');

	// get all executions for this submission
	let execs = executions.filter(x => x.sid === sbm.id);

	// sort by id
	execs.sort((a, b) => a.id - b.id);

	// render to 'details' element
	const details = document.createElement('div');
	execs.map(x => details.appendChild(renderExecution(x)));

	const date = (new Date(sbm.date)).toISOString().substring(0, 16).replace('T', ' ');
	const score = sbm.score.toFixed();

	const dlBtnHTML = `<button class="ui mini compact icon button"><i class="download icon"></i></button>`;
	el.innerHTML = `<td>${date}</td><td>${score}</td><td>${details.innerHTML}</td><td>${dlBtnHTML}`;

	return el;
};

const renderSubmissionsTable = () => {
	// get id of currently selected problem
	const probId = Number(selectedProbEl.id.substring(2));

	// get all submissions for this problem
	let sbms = submissions.filter(x => x.problem_id === probId);

	// sort by date
	sbms.sort((a, b) => b.date - a.date);

	// clear table
	sbmTableEl.innerHTML = '';

	// fill table
	sbms.map(x => sbmTableEl.appendChild(renderSubmission(x, executions)));
};

window.onload = () => {
	let submissionReady = false;
	let problemsReady = false;
	const ready = (what) => {
		if(what === 'submissions') {
			submissionReady = true;
			if(problemsReady) renderSubmissionsTable();
		} else if(what === 'problems') {
			problemsReady = true;
			renderProblemList();
			if(submissionReady) renderSubmissionsTable();
		}
	};

	fetch('/problems')
	.then(resp => resp.json())
	.then(json => {
		problems = json;
		ready('problems');
	});

	fetch('/submissions/all')
	.then(resp => resp.json())
	.then(json => {
		submissions = json.submissions;
		executions = json.executions;
		ready('submissions');
	});
}
